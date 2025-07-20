import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, map, catchError, take, of, forkJoin } from 'rxjs';
import { Post, PostImage } from '../models/post.model';
import { User } from '../models/user.model';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';
import { NotificationService } from './notification.service';
import { UserService } from './user.service';

interface PaginatedResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Post[];
  isArrayResponse?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PostService {
  private baseUrl = environment.apiUrl + '/api';
  private posts = new BehaviorSubject<Post[]>([]);
  public posts$ = this.posts.asObservable();
  private currentPage = 1;
  private hasMore = true;
  private loading = false;
  private apiUrl = environment.apiUrl;
  private userCache = new Map<string, User>(); // Cache for user data

  // User profile posts pagination
  private userPosts = new BehaviorSubject<Post[]>([]);
  public userPosts$ = this.userPosts.asObservable();
  private userPostsCurrentPage = 1;
  private userPostsHasMore = true;
  private userPostsLoading = false;
  private currentUserHandle: string | null = null;
  private allUserPosts: Post[] = []; // Store all posts for client-side pagination
  private readonly postsPerPage = 20;

  // User profile replies pagination
  private userReplies = new BehaviorSubject<Post[]>([]);
  public userReplies$ = this.userReplies.asObservable();
  private userRepliesCurrentPage = 1;
  private userRepliesHasMore = true;
  private userRepliesLoading = false;
  private allUserReplies: Post[] = []; // Store all replies for client-side pagination

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private toastService: ToastService,
    private notificationService: NotificationService,
    private userService: UserService
  ) {
    console.log('PostService constructor called');
    
    // Listen for appeal_approved notifications to refresh timeline
    this.notificationService.notificationEvents$.subscribe(notification => {
      console.log('📨 PostService received notification:', notification.notification_type);
      if (notification.notification_type === 'appeal_approved') {
        console.log('🔄 Appeal approved notification received, refreshing timeline');
        // Refresh the timeline to show the restored post
        this.refreshTimeline();
        this.toastService.showSuccess('Your post has been restored to your timeline');
      }
    });
  }

  createPost(contentOrFormData: string | FormData, files?: File[], scheduledTime?: Date): Observable<Post> {
    if (contentOrFormData instanceof FormData) {
      if (scheduledTime) {
        contentOrFormData.append('scheduled_time', scheduledTime.toISOString());
      }
      return this.http.post<Post>(`${this.baseUrl}/posts/`, contentOrFormData).pipe(
        tap(newPost => {
          // Only add to timeline if it's not scheduled (immediate post)
          if (!scheduledTime) {
            const currentPosts = this.posts.getValue();
            this.posts.next([newPost, ...currentPosts]);
          }
        })
      );
    }

    const formData = new FormData();
    formData.append('content', contentOrFormData);
    if (files) {
      files.forEach((file, index) => {
        formData.append(`image_${index}`, file);
      });
    }
    if (scheduledTime) {
      formData.append('scheduled_time', scheduledTime.toISOString());
    }
    
    return this.http.post<Post>(`${this.baseUrl}/posts/`, formData).pipe(
      tap(newPost => {
        // Only add to timeline if it's not scheduled (immediate post)
        if (!scheduledTime) {
          const currentPosts = this.posts.getValue();
          this.posts.next([newPost, ...currentPosts]);
        }
      })
    );
  }

  loadPosts(refresh: boolean = false, activeTab?: string): void {
    // Always reset page number when loading posts initially
    this.currentPage = 1;
    this.hasMore = true;
    
    this.loading = true;
    const followingOnly = localStorage.getItem('following_only_preference') === 'true';

    // Clear current posts if refreshing
    if (refresh) {
      this.posts.next([]);
    }

    const source = this.authService.isAuthenticated() ? this.getFeed(activeTab) : this.getExplore(activeTab);
    source.pipe(
      take(1),
      map((response: PaginatedResponse) => {
        if (!response || !response.results) {
          this.posts.next([]);
          return;
        }

        this.hasMore = !!response.next;
        
        // Always emit new posts array to force change detection
        const newPosts = [...response.results];
        this.posts.next(newPosts);
        
        // Only increment page number if there are more posts to load
        if (this.hasMore) {
          this.currentPage++;
        }
      }),
      catchError((error) => {
        this.loading = false;
        this.hasMore = false;
        this.posts.next([]);
        return of(undefined);
      }),
      tap({
        next: () => {
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        }
      })
    ).subscribe();
  }

  private getFeed(activeTab?: string): Observable<PaginatedResponse> {
    const tab = activeTab || localStorage.getItem('activeTab') || 'for-you';
    const postType = tab === 'human-drawing' ? 'human_drawing' : 'all';
    const followingOnly = localStorage.getItem('following_only_preference') === 'true';
    const url = `${this.baseUrl}/posts/feed/?page=${this.currentPage}&post_type=${postType}&following_only=${followingOnly}`;
    return this.http.get<PaginatedResponse>(url).pipe(
      map((response: PaginatedResponse) => ({
        ...response,
        results: this.enrichAuthorsSync(response.results.map(post => this.addImageUrls(post)))
      }))
    );
  }

  private getExplore(activeTab?: string): Observable<PaginatedResponse> {
    const tab = activeTab || localStorage.getItem('activeTab') || 'for-you';
    const postType = tab === 'human-drawing' ? 'human_drawing' : 'all';
    const followingOnly = localStorage.getItem('following_only_preference') === 'true';
    const url = `${this.baseUrl}/posts/explore/?page=${this.currentPage}&post_type=${postType}&following_only=${followingOnly}`;
    return this.http.get<PaginatedResponse>(url).pipe(
      map((response: PaginatedResponse) => ({
        ...response,
        results: this.enrichAuthorsSync(response.results.map(post => this.addImageUrls(post)))
      }))
    );
  }

  // Method to refresh posts after verification
  refreshPosts(): void {
    this.loadPosts(true);
  }

  get isLoading(): boolean {
    return this.loading;
  }

  get hasMorePosts(): boolean {
    return this.hasMore;
  }

  // User posts pagination getters
  get hasMoreUserPosts(): boolean {
    return this.userPostsHasMore;
  }

  get isLoadingUserPosts(): boolean {
    return this.userPostsLoading;
  }

  // User replies pagination getters
  get hasMoreUserReplies(): boolean {
    return this.userRepliesHasMore;
  }

  get isLoadingUserReplies(): boolean {
    return this.userRepliesLoading;
  }

  getPost(handle: string, postId: number): Observable<Post> {
    return this.http.get<Post>(`${this.baseUrl}/posts/${handle}/${postId}/`);
  }

  getPostById(postId: number): Observable<Post> {
    return this.http.get<Post>(`${this.baseUrl}/posts/by-id/${postId}/`);
  }

  getUserPosts(handle: string, refresh: boolean = false): void {
    console.log('📄 getUserPosts called:', { handle, refresh, currentHandle: this.currentUserHandle });

    // Reset pagination if it's a new user or refresh
    if (refresh || this.currentUserHandle !== handle) {
      this.userPostsCurrentPage = 1;
      this.userPostsHasMore = true;
      this.currentUserHandle = handle;
      this.allUserPosts = []; // Clear cached posts
      // Don't clear userPosts immediately - let it stay until we have new data
    }

    // If we already have all posts cached, do client-side pagination
    if (this.allUserPosts.length > 0) {
      console.log('📄 Using cached posts for pagination');
      this.loadMoreFromCache();
      return;
    }

    this.userPostsLoading = true;
    console.log('📄 Loading posts with fast-first strategy for handle:', handle);
    
    const params = new HttpParams();

    this.http.get<Post[]>(`${this.apiUrl}/api/posts/user/${handle}/posts/`, { params }).subscribe({
      next: (rawPosts) => {
        console.log('📄 Received raw posts from API:', rawPosts.length);
        
        // FAST PATH: Process and show first 20 posts immediately
        const firstBatch = rawPosts.slice(0, this.postsPerPage);
        const processedFirstBatch = firstBatch.map((post: Post) => this.addImageUrls(post));
        
        // Show first batch immediately
        this.userPosts.next(processedFirstBatch);
        this.userPostsLoading = false;
        this.userPostsHasMore = rawPosts.length > this.postsPerPage;
        
        console.log(`📄 First batch shown instantly for ${handle}:`, {
          batchSize: processedFirstBatch.length,
          totalPosts: rawPosts.length,
          hasMore: this.userPostsHasMore
        });
        
        // BACKGROUND: Process remaining posts asynchronously
        if (rawPosts.length > this.postsPerPage) {
          console.log('📄 Processing remaining posts in background...');
          
          // Use setTimeout to process remaining posts without blocking UI
          setTimeout(() => {
            const remainingPosts = rawPosts.slice(this.postsPerPage);
            const processedRemaining = remainingPosts.map((post: Post) => this.addImageUrls(post));
            
            // Store all processed posts for pagination
            this.allUserPosts = [...processedFirstBatch, ...processedRemaining];
            
            console.log('📄 Background processing complete:', {
              totalProcessed: this.allUserPosts.length,
              backgroundProcessed: processedRemaining.length
            });
          }, 100); // Small delay to let UI render
        } else {
          // All posts fit in first batch
          this.allUserPosts = processedFirstBatch;
        }
      },
      error: (error) => {
        console.error('Error loading user posts:', error);
        this.userPostsLoading = false;
        this.userPostsHasMore = false;
      }
    });
  }

  private loadMoreFromCache(): void {
    console.log('📄 loadMoreFromCache called:', {
      loading: this.userPostsLoading,
      hasMore: this.userPostsHasMore,
      currentPosts: this.userPosts.getValue().length,
      totalCached: this.allUserPosts.length
    });

    if (this.userPostsLoading || !this.userPostsHasMore) {
      console.log('📄 Skipping loadMoreFromCache - already loading or no more posts');
      return;
    }

    this.userPostsLoading = true;

    // Simulate network delay for better UX
    setTimeout(() => {
      const currentPosts = this.userPosts.getValue();
      const startIndex = currentPosts.length;
      const endIndex = startIndex + this.postsPerPage;
      const nextPagePosts = this.allUserPosts.slice(startIndex, endIndex);
      
      const newPosts = [...currentPosts, ...nextPagePosts];
      this.userPosts.next(newPosts);
      
      // Check if there are more posts to show
      this.userPostsHasMore = newPosts.length < this.allUserPosts.length;
      this.userPostsLoading = false;
      
      console.log(`📄 Loaded more posts from cache:`, {
        newPostsCount: nextPagePosts.length,
        totalShowing: newPosts.length,
        totalAvailable: this.allUserPosts.length,
        hasMore: this.userPostsHasMore,
        startIndex,
        endIndex
      });
    }, 300); // Small delay to show loading state
  }

  loadMoreUserPosts(): void {
    console.log('📄 loadMoreUserPosts called in service:', {
      loading: this.userPostsLoading,
      hasMore: this.userPostsHasMore,
      currentPage: this.userPostsCurrentPage
    });

    if (!this.userPostsLoading && this.userPostsHasMore) {
      this.userPostsCurrentPage++;
      console.log('📄 Incremented page to:', this.userPostsCurrentPage);
      this.loadMoreFromCache();
    } else {
      console.log('📄 Cannot load more - already loading or no more posts');
    }
  }

  clearUserPosts(): void {
    this.userPosts.next([]);
    this.userPostsCurrentPage = 1;
    this.userPostsHasMore = true;
    this.userPostsLoading = false;
    this.currentUserHandle = null;
    this.allUserPosts = [];
  }

  private loadMoreRepliesFromCache(): void {
    console.log('📄 loadMoreRepliesFromCache called:', {
      loading: this.userRepliesLoading,
      hasMore: this.userRepliesHasMore,
      currentReplies: this.userReplies.getValue().length,
      totalCached: this.allUserReplies.length
    });

    if (this.userRepliesLoading || !this.userRepliesHasMore) {
      console.log('📄 Skipping loadMoreRepliesFromCache - already loading or no more replies');
      return;
    }

    this.userRepliesLoading = true;

    // Simulate network delay for better UX
    setTimeout(() => {
      const currentReplies = this.userReplies.getValue();
      const startIndex = currentReplies.length;
      const endIndex = startIndex + this.postsPerPage;
      const nextPageReplies = this.allUserReplies.slice(startIndex, endIndex);
      
      const newReplies = [...currentReplies, ...nextPageReplies];
      this.userReplies.next(newReplies);
      
      // Check if there are more replies to show
      this.userRepliesHasMore = newReplies.length < this.allUserReplies.length;
      this.userRepliesLoading = false;
      
      console.log(`📄 Loaded more replies from cache:`, {
        newRepliesCount: nextPageReplies.length,
        totalShowing: newReplies.length,
        totalAvailable: this.allUserReplies.length,
        hasMore: this.userRepliesHasMore,
        startIndex,
        endIndex
      });
    }, 300);
  }

  loadMoreUserReplies(): void {
    console.log('📄 loadMoreUserReplies called in service:', {
      loading: this.userRepliesLoading,
      hasMore: this.userRepliesHasMore,
      currentPage: this.userRepliesCurrentPage
    });

    if (!this.userRepliesLoading && this.userRepliesHasMore) {
      this.userRepliesCurrentPage++;
      console.log('📄 Incremented replies page to:', this.userRepliesCurrentPage);
      this.loadMoreRepliesFromCache();
    } else {
      console.log('📄 Cannot load more replies - already loading or no more replies');
    }
  }

  clearUserReplies(): void {
    this.userReplies.next([]);
    this.userRepliesCurrentPage = 1;
    this.userRepliesHasMore = true;
    this.userRepliesLoading = false;
    this.allUserReplies = [];
  }

  createPostWithFormData(formData: FormData, isReply: boolean = false, handle?: string, postId?: number, scheduledTime?: Date): Observable<Post> {
    const url = isReply && handle && postId 
      ? `${this.baseUrl}/posts/${handle}/${postId}/replies/`
      : `${this.baseUrl}/posts/`;
    
    if (scheduledTime) {
      formData.append('scheduled_time', scheduledTime.toISOString());
    }
    
    return this.http.post<Post>(url, formData).pipe(
      map(post => this.addImageUrls(post)),
      tap(newPost => {
        // Only add to timeline if it's not scheduled (immediate post)
        if (!scheduledTime) {
          const currentPosts = this.posts.getValue();
          const activeTab = localStorage.getItem('activeTab') || 'for-you';
          
          if (activeTab === 'human-drawing' && newPost.is_human_drawing && newPost.is_verified) {
            // Only add to Human Art tab if it's a verified human drawing
            this.posts.next([newPost, ...currentPosts]);
          } else if (activeTab === 'for-you') {
            // Add to For You tab
            this.posts.next([newPost, ...currentPosts]);
          }
        }
      })
    );
  }

  createQuotePost(content: string, handle: string, postId: number, images?: File[]): Observable<Post> {
    const formData = new FormData();
    formData.append('content', content);
    formData.append('post_type', 'quote');
    if (images) {
      images.forEach((image, index) => {
        formData.append(`image_${index}`, image);
      });
    }
    return this.http.post<Post>(`${this.baseUrl}/posts/${handle}/${postId}/quote/`, formData).pipe(
      map(post => this.addImageUrls(post))
    );
  }

  likePost(handle: string, postId: number): Observable<{liked: boolean}> {
    console.log('[PostService] Like post called:', { handle, postId });
    return this.http.post<{liked: boolean}>(`${this.baseUrl}/posts/${handle}/${postId}/like/`, {}).pipe(
      tap(response => {
        console.log('[PostService] Like API response:', response);
      })
    );
  }

  repost(handle: string, postId: number): Observable<Post> {
    return this.http.post<Post>(`${this.baseUrl}/posts/${handle}/${postId}/repost/`, {}).pipe(
      map(post => this.addImageUrls(post))
    );
  }

  repostPost(authorHandle: string, postId: string): Observable<{reposted: boolean}> {
    return this.http.post<{reposted: boolean}>(`${this.baseUrl}/posts/${authorHandle}/${postId}/repost/`, {});
  }

  quotePost(handle: string, postId: number, content: string, image?: File): Observable<Post> {
    const formData = new FormData();
    formData.append('content', content);
    if (image) {
      formData.append('image', image);
    }
    return this.http.post<Post>(`${this.baseUrl}/posts/${handle}/post/${postId}/quote/`, formData).pipe(
      map(post => this.addImageUrls(post))
    );
  }

  getBookmarkedPosts(handle: string): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseUrl}/posts/${handle}/bookmarks/`).pipe(
      map(posts => posts.map(post => this.addImageUrls(post)))
    );
  }

  getLikedPosts(handle: string): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseUrl}/posts/${handle}/liked/`).pipe(
      map(posts => posts.map(post => this.addImageUrls(post)))
    );
  }

  getMediaPosts(handle: string): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseUrl}/posts/${handle}/media/`).pipe(
      map(posts => posts.map(post => this.addImageUrls(post)))
    );
  }

  searchPosts(query: string): Observable<Post[]> {
    // For hashtag searches, we'll search in the content field
    return this.http.get<Post[]>(`${this.baseUrl}/posts/search/`, {
      params: { q: query }
    }).pipe(
      map(posts => posts.map(post => this.addImageUrls(post)))
    );
  }

  bookmarkPost(handle: string, postId: number): Observable<void> {
    console.log('[PostService] Bookmark post called:', { handle, postId });
    return this.http.post<void>(`${this.baseUrl}/posts/${handle}/${postId}/bookmark/`, {}).pipe(
      tap(() => {
        console.log('[PostService] Bookmark API call successful');
      })
    );
  }

  deletePost(handle: string, postId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/posts/${handle}/post/${postId}/`).pipe(
      tap(() => {
        const currentPosts = this.posts.value;
        const updatedPosts = currentPosts.filter(post => post.id !== postId);
        this.posts.next(updatedPosts);
      })
    );
  }

  getUserPostsByHandle(handle: string): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseUrl}/posts/${handle}/`).pipe(
      map(posts => posts.map(post => this.addImageUrls(post)))
    );
  }

  verifyHumanArt(handle: string, postId: number): Observable<Post> {
    return this.http.post<Post>(`${this.baseUrl}/posts/${handle}/post/${postId}/verify_drawing/`, {}).pipe(
      map(post => this.addImageUrls(post))
    );
  }

  // Add this method to load a single post and update its state
  refreshPost(authorHandle: string, postId: number): Observable<Post> {
    return this.http.get<Post>(`${this.baseUrl}/posts/${authorHandle}/${postId}/`).pipe(
      map(post => this.addImageUrls(post)),
      tap(post => {
        const posts = this.posts.getValue();
        const index = posts.findIndex(p => p.id === postId);
        if (index !== -1) {
          posts[index] = post;
          this.posts.next(posts);
        }
      })
    );
  }

  refreshTimeline() {
    // Use the same loading mechanism as normal timeline loading
    // This ensures proper handling of tabs, user preferences, and filtering
    console.log('🔄 Refreshing timeline with current settings');
    this.loadPosts(true);
  }

  getPosts(): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseUrl}/posts/`).pipe(
      map(posts => posts.map(post => this.addImageUrls(post))),
      map(posts => this.enrichAuthorsSync(posts))
    );
  }

  createReplyWithFormData(handle: string, postId: number, formData: FormData): Observable<Post> {
    const url = `${this.baseUrl}/posts/${handle}/${postId}/replies/`;
    
    // Log FormData contents
    console.log('FormData contents:');
    formData.forEach((value, key) => {
      console.log(`${key}:`, value);
      if (value instanceof File) {
        console.log(`${key} is a File:`, {
          name: value.name,
          type: value.type,
          size: value.size
        });
      }
    });

    console.log('Making request to:', url);
    
    return this.http.post<Post>(url, formData).pipe(
      map(post => this.addImageUrls(post)),
      tap(post => {
        console.log('Response from server:', post);
      })
    );
  }

  createReply(handle: string, postId: number, content: string, images?: File[]): Observable<Post> {
    const formData = new FormData();
    formData.append('content', content);
    
    if (images && images.length > 0) {
      images.forEach((file, index) => {
        // Validate file
        if (!(file instanceof File)) {
          console.error(`Invalid file at index ${index}:`, file);
          return;
        }
        
        // Log file details
        console.log(`Appending file ${index}:`, {
          name: file.name,
          type: file.type,
          size: file.size,
          isFile: file instanceof File
        });
        
        formData.append(`image_${index}`, file);
      });
    }

    // Log FormData contents
    console.log('FormData contents before sending:');
    formData.forEach((value, key) => {
      console.log(`${key}:`, value);
      if (value instanceof File) {
        console.log(`${key} is a File:`, {
          name: value.name,
          type: value.type,
          size: value.size
        });
      }
    });
    console.log("formData1111: ", formData);
    return this.http.post<Post>(`${this.baseUrl}/posts/${handle}/${postId}/replies/`, formData).pipe(
      map(post => this.addImageUrls(post))
    );
  }

  private addImageUrls(post: Post): Post {
    // Create a new post object to avoid mutations
    const processedPost = { ...post };
    
    console.log('Processing post images for post:', post.id);
    console.log('Raw post images:', post.images);
    
    if (processedPost.image) {
      console.log('Single image before processing:', processedPost.image);
      if (!processedPost.image.startsWith('http') && !processedPost.image.startsWith('data:')) {
        const imagePath = processedPost.image.startsWith('/') ? processedPost.image : `/${processedPost.image}`;
        processedPost.image = `${this.baseUrl}${imagePath}`;
        console.log('Single image after processing:', processedPost.image);
      }
    }
    
    if (processedPost.author?.profile_picture) {
      console.log('Profile picture before processing:', processedPost.author.profile_picture);
      if (!processedPost.author.profile_picture.startsWith('http') && !processedPost.author.profile_picture.startsWith('data:')) {
        const profilePath = processedPost.author.profile_picture.startsWith('/') ? processedPost.author.profile_picture : `/${processedPost.author.profile_picture}`;
        processedPost.author = {
          ...processedPost.author,
          profile_picture: `${this.baseUrl}${profilePath}`
        };
        console.log('Profile picture after processing:', processedPost.author.profile_picture);
      }
    }

    if (processedPost.images) {
      console.log('Processing multiple images:', processedPost.images);
      processedPost.images = processedPost.images.map(image => {
        console.log('Processing image:', image);
        const processedImage = {
          ...image,
          image: !image.image.startsWith('http') ? `${this.baseUrl}${image.image.startsWith('/') ? image.image : `/${image.image}`}` : image.image
        };
        console.log('Processed image:', processedImage);
        return processedImage;
      });
      console.log('Final processed images:', processedPost.images);
    }

    return processedPost;
  }

  private enrichAuthorsSync(posts: Post[]): Post[] {
    // Get unique author handles that need enrichment
    const authorsToEnrich = posts
      .filter(post => post.author && !post.author.bio)
      .map(post => post.author.handle)
      .filter((handle, index, array) => array.indexOf(handle) === index); // Remove duplicates

    // Fetch author data for all missing authors
    if (authorsToEnrich.length > 0) {
      authorsToEnrich.forEach(handle => {
        if (!this.userCache.has(handle)) {
          this.userService.getUserByHandle(handle).subscribe({
            next: (userData: User) => {
              this.userCache.set(handle, userData);
              // Update all posts with this author
              this.updatePostsWithAuthorData(handle, userData);
            },
            error: (error) => {
              console.error(`Error fetching user data for ${handle}:`, error);
            }
          });
        }
      });
    }

    // Apply cached data to posts
    return posts.map(post => {
      if (post.author && this.userCache.has(post.author.handle)) {
        const cachedUser = this.userCache.get(post.author.handle)!;
        post.author = {
          ...post.author,
          bio: cachedUser.bio,
          followers_count: cachedUser.followers_count,
          following_count: cachedUser.following_count,
          is_following: cachedUser.is_following
        };
      }
      return post;
    });
  }

  private updatePostsWithAuthorData(handle: string, userData: User): void {
    const currentPosts = this.posts.getValue();
    const updatedPosts = currentPosts.map(post => {
      if (post.author && post.author.handle === handle) {
        return {
          ...post,
          author: {
            ...post.author,
            bio: userData.bio,
            followers_count: userData.followers_count,
            following_count: userData.following_count,
            is_following: userData.is_following
          }
        };
      }
      return post;
    });
    this.posts.next(updatedPosts);
  }

  // Add new method to filter posts based on active tab
  private filterPostsByTab(posts: Post[]): Post[] {
    const activeTab = localStorage.getItem('activeTab') || 'for-you';
    console.log('Filtering posts for tab:', activeTab);
    
    if (activeTab === 'human-drawing') {
      // For Human Art tab, only show verified human drawings
      console.log('Filtering for human art posts...');
      const humanArtPosts = posts.filter(post => {
        console.log('Post:', post.id, 'is_human_drawing:', post.is_human_drawing, 'is_verified:', post.is_verified);
        return post.is_human_drawing === true && post.is_verified === true;
      });
      console.log('Verified human art posts found:', humanArtPosts.length);
      return humanArtPosts;
    } else {
      // For For You tab, show all posts including unverified human art
      console.log('Filtering for For You tab...');
      const forYouPosts = posts;
      console.log('For You posts found:', forYouPosts.length);
      return forYouPosts;
    }
  }

  loadMorePosts(): void {
    if (!this.loading && this.hasMore) {
      this.loading = true;
      const source = this.authService.isAuthenticated() ? this.getFeed() : this.getExplore();
      source.pipe(
        take(1)
      ).subscribe({
        next: (response: PaginatedResponse) => {
          if (!response || !response.results) {
            console.error('Invalid response format:', response);
            this.loading = false;
            return;
          }

          const currentPosts = this.posts.getValue();
          this.posts.next([...currentPosts, ...(response.results || [])]);
          this.hasMore = !!response.next;
          this.loading = false;
          // Only increment page number if there are more posts to load
          if (this.hasMore) {
            this.currentPage++;
          }
        },
        error: (error) => {
          console.error('Error loading more posts:', error);
          this.loading = false;
          this.hasMore = false;
        }
      });
    }
  }

  toggleLike(postId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/posts/${postId}/like/`, {});
  }

  toggleBookmark(postId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/posts/${postId}/bookmark/`, {});
  }

  getUserReplies(handle: string, refresh: boolean = false): void {
    console.log('📄 getUserReplies called:', { handle, refresh });

    // Reset pagination if it's a new user or refresh
    if (refresh || this.currentUserHandle !== handle) {
      this.userRepliesCurrentPage = 1;
      this.userRepliesHasMore = true;
      this.allUserReplies = [];
    }

    // If we already have all replies cached, do client-side pagination
    if (this.allUserReplies.length > 0) {
      console.log('📄 Using cached replies for pagination');
      this.loadMoreRepliesFromCache();
      return;
    }

    this.userRepliesLoading = true;
    console.log('📄 Loading replies from API for handle:', handle);

    this.http.get<Post[]>(`${this.apiUrl}/api/posts/user/${handle}/replies/`).pipe(
      map((replies: Post[]) => replies.map((reply: Post) => this.addImageUrls(reply)))
    ).subscribe({
      next: (replies) => {
        console.log('📄 Received replies from API:', replies.length);
        
        // Store all replies for client-side pagination  
        this.allUserReplies = replies.filter(post => post.post_type === 'reply');
        
        // Load first page (20 replies)
        const firstPageReplies = this.allUserReplies.slice(0, this.postsPerPage);
        console.log('📄 Sending first page replies to component:', firstPageReplies.length);
        
        this.userReplies.next(firstPageReplies);
        
        // Set hasMore based on whether there are more replies to show
        this.userRepliesHasMore = this.allUserReplies.length > this.postsPerPage;
        this.userRepliesLoading = false;
        
        console.log(`📄 Loaded user replies for ${handle} (client-side pagination):`, {
          totalAvailable: this.allUserReplies.length,
          currentlyShowing: firstPageReplies.length,
          hasMore: this.userRepliesHasMore,
          currentPage: this.userRepliesCurrentPage
        });
      },
      error: (error) => {
        console.error('Error loading user replies:', error);
        this.userRepliesLoading = false;
        this.userRepliesHasMore = false;
      }
    });
  }

  getUserMedia(handle: string): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.apiUrl}/api/posts/user/${handle}/media/`);
  }

  getUserHumanArt(handle: string): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.apiUrl}/api/posts/user/${handle}/human-art/`);
  }

  getUserLikes(handle: string): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.apiUrl}/api/posts/user/${handle}/likes/`);
  }

  getPublicPosts(tab: string = 'for-you'): Observable<{ results: Post[] }> {
    return this.http.get<{ results: Post[] }>(`${this.baseUrl}/posts/public/`, {
      params: { tab }
    });
  }

  getScheduledPosts(): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseUrl}/posts/scheduled/`);
  }

  getReportTypes(handle: string, postId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/posts/${handle}/${postId}/report-types/`);
  }

  reportPost(handle: string, postId: number, reportData: { report_type: string; description: string }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/posts/${handle}/${postId}/report/`, reportData);
  }

  getReportedPosts(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/posts/reported/`);
  }
} 