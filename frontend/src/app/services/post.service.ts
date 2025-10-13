import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, map, catchError, take, of, forkJoin, timeout, retry } from 'rxjs';
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
  
  /**
   * Get current posts value without making HTTP request
   */
  public getCurrentPosts(): Post[] {
    return this.posts.getValue();
  }

  /**
   * Cache posts for a specific home tab
   */
  public cacheHomeTabPosts(tab: 'for-you' | 'human-drawing', posts: Post[]): void {
    this.homeTabCache.set(tab, {
      posts: [...posts],
      timestamp: Date.now()
    });
  }

  /**
   * Get cached posts for a specific home tab
   */
  public getCachedHomeTabPosts(tab: 'for-you' | 'human-drawing'): Post[] | null {
    const cached = this.homeTabCache.get(tab);
    return cached ? cached.posts : null;
  }

  /**
   * Check if a home tab has cached content
   */
  public hasCachedHomeTabContent(tab: 'for-you' | 'human-drawing'): boolean {
    const cached = this.homeTabCache.get(tab);
    return Boolean(cached && cached.posts.length > 0);
  }

  /**
   * Clear cache for a specific home tab
   */
  public clearHomeTabCache(tab: 'for-you' | 'human-drawing'): void {
    this.homeTabCache.delete(tab);
  }
  
  // Cache for different tabs and following preferences
  private postsCache = new Map<string, {
    posts: Post[];
    timestamp: number;
    hasMore: boolean;
    currentPage: number;
  }>();

  // Cache for home component tabs (separate from postsCache to prevent corruption)
  private homeTabCache = new Map<'for-you' | 'human-drawing', {
    posts: Post[];
    timestamp: number;
  }>();

  // Cache for search results and trending content
  private searchCache = new Map<string, {
    posts: Post[];
    users: User[];
    timestamp: number;
    hasMore: boolean;
    currentPage: number;
  }>();

  // Cache for profile page data
  private profileCache = new Map<string, {
    media: Post[];
    humanArt: Post[];
    likes: Post[];
    timestamp: number;
  }>();
  
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
  // User profile replies pagination
  private userReplies = new BehaviorSubject<Post[]>([]);
  public userReplies$ = this.userReplies.asObservable();
  private userRepliesCurrentPage = 1;
  private userRepliesHasMore = true;
  private userRepliesLoading = false;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private toastService: ToastService,
    private notificationService: NotificationService,
    private userService: UserService
  ) {
    // Subscribe to authentication state changes
    this.authService.currentUser$.subscribe((user: any) => {
      if (user) {
        // User logged in - start global new posts checking
        this.startGlobalNewPostsCheck();
      } else {
        // User logged out - stop global new posts checking
        this.stopGlobalNewPostsCheck();
        // Clear all caches
        this.clearAllCaches();
      }
    });
    
    // Listen for appeal_approved notifications to refresh timeline
    this.notificationService.notificationEvents$.subscribe(notification => {
      if (notification.notification_type === 'appeal_approved') {
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
    const cacheKey = this.getCacheKey(activeTab);
    
    // Check if we have valid cached data and don't need to refresh
    // Always use cache when not explicitly refreshing, even if there are new posts
    if (!refresh && this.isCacheValid(cacheKey)) {
      const cached = this.postsCache.get(cacheKey)!;
      this.posts.next(cached.posts);
      this.hasMore = cached.hasMore;
      this.currentPage = cached.currentPage;
      return; // Use cached data, no need to make HTTP request
    }
    
    // Always reset page number when loading posts initially
    this.currentPage = 1;
    this.hasMore = true;
    
    this.loading = true;
    const followingOnly = localStorage.getItem('following_only_preference') === 'true';

    // Clear current posts if refreshing, but only after a small delay
    // to ensure the loading state is properly shown
    if (refresh) {
      // Don't clear posts immediately - let the loading state show first
      // Posts will be replaced when the new data arrives
    }

    const source = this.authService.isAuthenticated() ? this.getFeed(activeTab) : this.getExplore(activeTab);
    source.pipe(
      take(1),
      // Add timeout to prevent infinite loading
      timeout(15000), // 15 second timeout
      // Retry failed requests up to 2 times
      retry({ count: 2, delay: 1000 }),
      map((response: PaginatedResponse) => {
        if (!response || !response.results) {
          this.posts.next([]);
          return;
        }

        this.hasMore = !!response.next;
        
        // Always emit new posts array to force change detection
        const newPosts = [...response.results];
        this.posts.next(newPosts);
        
        // Cache the posts for this tab and following preference
        this.postsCache.set(cacheKey, {
          posts: newPosts,
          timestamp: Date.now(),
          hasMore: this.hasMore,
          currentPage: this.currentPage
        });
        
        // Update global latest post timestamp for new posts checking
        const tab = activeTab || localStorage.getItem('activeTab') || 'for-you';
        this.updateGlobalLatestPostTimestamp(tab as 'for-you' | 'human-drawing', newPosts);
        
        // Only increment page number if there are more posts to load
        if (this.hasMore) {
          this.currentPage++;
        }
      }),
      catchError((error) => {
        this.loading = false;
        this.hasMore = false;
        
        // Handle different types of errors
        if (error.name === 'TimeoutError') {
          console.error('Request timed out after 15 seconds');
          // Keep existing posts if available, don't clear them
          if (this.posts.getValue().length === 0) {
            this.posts.next([]);
          }
        } else {
          console.error('Error loading posts:', error);
          // Keep existing posts if available, don't clear them
          if (this.posts.getValue().length === 0) {
            this.posts.next([]);
          }
        }
        
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

  /**
   * Generate cache key for posts based on tab and following preference
   */
  private getCacheKey(activeTab?: string): string {
    const tab = activeTab || localStorage.getItem('activeTab') || 'for-you';
    const followingOnly = localStorage.getItem('following_only_preference') === 'true';
    return `${tab}_${followingOnly}`;
  }

  /**
   * Check if cached posts are still valid (less than 5 minutes old)
   */
  private isCacheValid(cacheKey: string): boolean {
    const cached = this.postsCache.get(cacheKey);
    if (!cached) return false;
    
    const cacheAge = Date.now() - cached.timestamp;
    const maxAge = 5 * 60 * 1000; // 5 minutes
    return cacheAge < maxAge;
  }

  /**
   * Clear all cached posts (useful for logout, etc.)
   */
  clearPostsCache(): void {
    this.postsCache.clear();
  }

  /**
   * Generate cache key for search results
   */
  private getSearchCacheKey(query: string, activeTab: string): string {
    return `search_${activeTab}_${query}`;
  }

  /**
   * Check if search cache is still valid (less than 10 minutes old)
   */
  private isSearchCacheValid(cacheKey: string): boolean {
    const cached = this.searchCache.get(cacheKey);
    if (!cached) return false;
    
    const cacheAge = Date.now() - cached.timestamp;
    const maxAge = 10 * 60 * 1000; // 10 minutes for search results
    return cacheAge < maxAge;
  }

  /**
   * Clear all search cache (useful for logout, etc.)
   */
  clearSearchCache(): void {
    this.searchCache.clear();
  }

  /**
   * Clear all caches (useful for logout, etc.)
   */
  clearAllCaches(): void {
    this.postsCache.clear();
    this.searchCache.clear();
    this.homeTabCache.clear();
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
    // Reset pagination if it's a new user or refresh
    if (refresh || this.currentUserHandle !== handle) {
      this.userPostsCurrentPage = 1;
      this.userPostsHasMore = true;
      this.currentUserHandle = handle;
      this.userPosts.next([]); // Clear current posts
    }

    this.userPostsLoading = true;
    
    const params = new HttpParams().set('page', this.userPostsCurrentPage.toString());

    this.http.get<PaginatedResponse>(`${this.apiUrl}/api/posts/user/${handle}/posts/`, { params }).subscribe({
      next: (response) => {
        if (!response || !response.results) {
          this.userPosts.next([]);
          this.userPostsLoading = false;
          this.userPostsHasMore = false;
          return;
        }

        const processedPosts = response.results.map((post: Post) => this.addImageUrls(post));
        
        if (this.userPostsCurrentPage === 1) {
          // First page - replace posts
          this.userPosts.next(processedPosts);
        } else {
          // Subsequent pages - append to existing posts
          const currentPosts = this.userPosts.getValue();
          this.userPosts.next([...currentPosts, ...processedPosts]);
        }
        
        this.userPostsLoading = false;
        this.userPostsHasMore = !!response.next;
        
        // Increment page for next load
        if (this.userPostsHasMore) {
          this.userPostsCurrentPage++;
        }
      },
      error: (error) => {
        console.error('Error loading user posts:', error);
        this.userPostsLoading = false;
        this.userPostsHasMore = false;
      }
    });
  }

  loadMoreUserPosts(): void {
    if (!this.userPostsLoading && this.userPostsHasMore && this.currentUserHandle) {
      this.getUserPosts(this.currentUserHandle);
    }
  }

  clearUserPosts(): void {
    this.userPosts.next([]);
    this.userPostsCurrentPage = 1;
    this.userPostsHasMore = true;
    this.userPostsLoading = false;
    this.currentUserHandle = null;
  }

  loadMoreUserReplies(): void {
    if (!this.userRepliesLoading && this.userRepliesHasMore && this.currentUserHandle) {
      this.getUserReplies(this.currentUserHandle);
    }
  }

  clearUserReplies(): void {
    this.userReplies.next([]);
    this.userRepliesCurrentPage = 1;
    this.userRepliesHasMore = true;
    this.userRepliesLoading = false;
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
    return this.http.post<{liked: boolean}>(`${this.baseUrl}/posts/${handle}/${postId}/like/`, {});
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

  /**
   * Get trending posts with caching
   */
  getTrendingPosts(activeTab: string = 'posts'): Observable<{ results: Post[], count: number, next: string | null, previous: string | null }> {
    const cacheKey = this.getSearchCacheKey('trending', activeTab);
    
    // Check if we have valid cached trending data
    if (this.isSearchCacheValid(cacheKey)) {
      const cached = this.searchCache.get(cacheKey)!;
      return of({
        results: cached.posts,
        count: cached.posts.length,
        next: cached.hasMore ? 'next' : null,
        previous: null
      });
    }
    
    // Get trending posts from the feed endpoint
    const postType = activeTab === 'human-drawing' ? 'human_drawing' : 'all';
    const url = `${this.baseUrl}/posts/feed/?page=1&post_type=${postType}&following_only=false`;
    
    return this.http.get<PaginatedResponse>(url).pipe(
      map(response => ({
        results: response.results,
        count: response.count,
        next: response.next,
        previous: response.previous
      })),
      map(response => ({
        ...response,
        results: this.enrichAuthorsSync(response.results.map(post => this.addImageUrls(post)))
      })),
      tap(response => {
        // Cache the trending posts
        this.searchCache.set(cacheKey, {
          posts: response.results,
          users: [],
          timestamp: Date.now(),
          hasMore: !!response.next,
          currentPage: 1
        });
      })
    );
  }

  searchPosts(query: string, page: number = 1, activeTab: string = 'posts'): Observable<{ results: Post[], count: number, next: string | null, previous: string | null }> {
    const cacheKey = this.getSearchCacheKey(query, activeTab);
    
    // Check if we have valid cached data for the first page
    if (page === 1 && this.isSearchCacheValid(cacheKey)) {
      const cached = this.searchCache.get(cacheKey)!;
      return of({
        results: cached.posts,
        count: cached.posts.length,
        next: cached.hasMore ? 'next' : null,
        previous: null
      });
    }
    
    // For hashtag searches, we'll search in the content field
    return this.http.get<{ results: Post[], count: number, next: string | null, previous: string | null }>(`${this.baseUrl}/posts/search/`, {
      params: { q: query, page: page.toString() }
    }).pipe(
      map(response => ({
        ...response,
        results: response.results.map(post => this.addImageUrls(post))
      })),
      tap(response => {
        // Cache the first page results
        if (page === 1) {
          this.searchCache.set(cacheKey, {
            posts: response.results,
            users: [], // Posts search doesn't return users
            timestamp: Date.now(),
            hasMore: !!response.next,
            currentPage: 1
          });
        }
      })
    );
  }

  bookmarkPost(handle: string, postId: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/posts/${handle}/${postId}/bookmark/`, {});
  }

  deletePost(handle: string, postId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/posts/${handle}/${postId}/soft_delete/`, null).pipe(
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
    return this.http.post<Post>(`${this.baseUrl}/posts/${handle}/${postId}/verify_drawing/`, {}).pipe(
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
    
    return this.http.post<Post>(url, formData).pipe(
      map(post => this.addImageUrls(post))
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
        
        formData.append(`image_${index}`, file);
      });
    }

    return this.http.post<Post>(`${this.baseUrl}/posts/${handle}/${postId}/replies/`, formData).pipe(
      map(post => this.addImageUrls(post))
    );
  }

  private addImageUrls(post: Post): Post {
    // Create a new post object to avoid mutations
    const processedPost = { ...post };
    
    if (processedPost.image) {
      if (!processedPost.image.startsWith('http') && !processedPost.image.startsWith('data:')) {
        const imagePath = processedPost.image.startsWith('/') ? processedPost.image : `/${processedPost.image}`;
        processedPost.image = `${this.baseUrl}${imagePath}`;
      }
    }
    
    if (processedPost.author?.profile_picture) {
      if (!processedPost.author.profile_picture.startsWith('http') && !processedPost.author.profile_picture.startsWith('data:')) {
        const profilePath = processedPost.author.profile_picture.startsWith('/') ? processedPost.author.profile_picture : `/${processedPost.author.profile_picture}`;
        processedPost.author = {
          ...processedPost.author,
          profile_picture: `${this.baseUrl}${profilePath}`
        };
      }
    }

    if (processedPost.images) {
      processedPost.images = processedPost.images.map(image => {
        return {
          ...image,
          image: !image.image.startsWith('http') ? `${this.baseUrl}${image.image.startsWith('/') ? image.image : `/${image.image}`}` : image.image
        };
      });
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
    
    if (activeTab === 'human-drawing') {
      // For Human Art tab, only show verified human drawings
      const humanArtPosts = posts.filter(post => {
        return post.is_human_drawing === true && post.is_verified === true;
      });
      return humanArtPosts;
    } else {
      // For For You tab, show all posts including unverified human art
      return posts;
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
    // Reset pagination if it's a new user or refresh
    if (refresh || this.currentUserHandle !== handle) {
      this.userRepliesCurrentPage = 1;
      this.userRepliesHasMore = true;
      this.currentUserHandle = handle;
      this.userReplies.next([]); // Clear current replies
    }

    this.userRepliesLoading = true;

    const params = new HttpParams().set('page', this.userRepliesCurrentPage.toString());

    this.http.get<PaginatedResponse>(`${this.apiUrl}/api/posts/user/${handle}/replies/`, { params }).subscribe({
      next: (response) => {
        if (!response || !response.results) {
          this.userReplies.next([]);
          this.userRepliesLoading = false;
          this.userRepliesHasMore = false;
          return;
        }

        const processedReplies = response.results.map((reply: Post) => this.addImageUrls(reply));
        
        if (this.userRepliesCurrentPage === 1) {
          // First page - replace replies
          this.userReplies.next(processedReplies);
        } else {
          // Subsequent pages - append to existing replies
          const currentReplies = this.userReplies.getValue();
          this.userReplies.next([...currentReplies, ...processedReplies]);
        }
        
        this.userRepliesLoading = false;
        this.userRepliesHasMore = !!response.next;
        
        // Increment page for next load
        if (this.userRepliesHasMore) {
          this.userRepliesCurrentPage++;
        }
      },
      error: (error) => {
        console.error('Error loading user replies:', error);
        this.userRepliesLoading = false;
        this.userRepliesHasMore = false;
      }
    });
  }

  getUserMedia(handle: string, forceRefresh: boolean = false): Observable<Post[]> {
    const cacheKey = `media_${handle}`;
    
    // Check if we have valid cached data and don't need to force refresh
    if (!forceRefresh && this.isProfileCacheValid(cacheKey)) {
      const cached = this.profileCache.get(cacheKey);
      if (cached) {
        return of(cached.media);
      }
    }

    return this.http.get<Post[]>(`${this.apiUrl}/api/posts/user/${handle}/media/`).pipe(
      tap(posts => {
        // Cache the media posts
        this.cacheProfileData(cacheKey, { media: posts, humanArt: [], likes: [] });
      })
    );
  }

  getUserLikes(handle: string, forceRefresh: boolean = false): Observable<Post[]> {
    const cacheKey = `likes_${handle}`;
    
    // Check if we have valid cached data and don't need to force refresh
    if (!forceRefresh && this.isProfileCacheValid(cacheKey)) {
      const cached = this.profileCache.get(cacheKey);
      if (cached) {
        return of(cached.likes);
      }
    }

    return this.http.get<Post[]>(`${this.apiUrl}/api/posts/user/${handle}/likes/`).pipe(
      tap(posts => {
        // Cache the liked posts
        this.cacheProfileData(cacheKey, { media: [], humanArt: [], likes: posts });
      })
    );
  }

  getUserHumanArt(handle: string, forceRefresh: boolean = false): Observable<Post[]> {
    const cacheKey = `humanArt_${handle}`;
    
    // Check if we have valid cached data and don't need to force refresh
    if (!forceRefresh && this.isProfileCacheValid(cacheKey)) {
      const cached = this.profileCache.get(cacheKey);
      if (cached) {
        return of(cached.humanArt);
      }
    }

    return this.http.get<Post[]>(`${this.apiUrl}/api/posts/user/${handle}/human-art/`).pipe(
      tap(posts => {
        // Cache the human art posts
        this.cacheProfileData(cacheKey, { media: [], humanArt: posts, likes: [] });
      })
    );
  }

  getPublicPosts(tab: string = 'for-you', page: number = 1): Observable<{ results: Post[], next: string | null, count: number }> {
    return this.http.get<{ results: Post[], next: string | null, count: number }>(`${this.baseUrl}/posts/public/`, {
      params: { tab, page: page.toString() }
    }).pipe(
      map(response => ({
        ...response,
        results: response.results.map(post => this.addImageUrls(post))
      }))
    );
  }

  getScheduledPosts(): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseUrl}/posts/scheduled/`);
  }

  getReportTypes(handle: string, postId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/moderation/posts/${handle}/${postId}/report-types/`);
  }

  reportPost(handle: string, postId: number, reportData: { report_type: string; description: string }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/moderation/posts/${handle}/${postId}/report/`, reportData);
  }

  getReportedPosts(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/moderation/posts/reported/`);
  }

  checkNewPosts(latestTimestamp: string, tab: string = 'for-you'): Observable<any> {
    const params = new HttpParams()
      .set('latest_timestamp', latestTimestamp)
      .set('tab', tab);
    return this.http.get<any>(`${this.baseUrl}/posts/check_new_posts/`, { params });
  }

  /**
   * Check for new posts across both tabs in a single request
   */
  checkNewPostsBothTabs(forYouTimestamp: string, humanArtTimestamp: string): Observable<any> {
    const params = new HttpParams()
      .set('for_you_timestamp', forYouTimestamp)
      .set('human_art_timestamp', humanArtTimestamp);
    return this.http.get<any>(`${this.baseUrl}/posts/check_new_posts_both/`, { params });
  }

  // Global new posts state
  private globalHasNewPosts = false;
  private globalNewPostsCount = 0;
  private globalNewPostsAuthors: Array<{ avatar?: string, username: string }> = [];
  private globalLatestPostTimestamps: { [key: string]: string | null } = {
    'for-you': null,
    'human-drawing': null
  };
  private globalNewPostsCheckInterval: any;
  private newPostsState = new BehaviorSubject<{
    hasNewPosts: boolean;
    newPostsCount: number;
    newPostsAuthors: Array<{ avatar?: string, username: string }>;
  }>({
    hasNewPosts: false,
    newPostsCount: 0,
    newPostsAuthors: []
  });

  newPostsState$ = this.newPostsState.asObservable();

  /**
   * Start global new posts checking (runs continuously regardless of current page)
   */
  public startGlobalNewPostsCheck(): void {
    // Clear any existing interval
    if (this.globalNewPostsCheckInterval) {
      clearInterval(this.globalNewPostsCheckInterval);
      this.globalNewPostsCheckInterval = null;
    }
    
    // Start checking every 20 seconds
    this.globalNewPostsCheckInterval = setInterval(() => {
      this.performGlobalNewPostsCheck();
    }, 20000); // 20 seconds
  }

  /**
   * Stop global new posts checking
   */
  public stopGlobalNewPostsCheck(): void {
    if (this.globalNewPostsCheckInterval) {
      clearInterval(this.globalNewPostsCheckInterval);
      this.globalNewPostsCheckInterval = null;
    }
  }

  /**
   * Perform the actual check for new posts globally
   */
  private performGlobalNewPostsCheck(): void {
    const forYouTimestamp = this.globalLatestPostTimestamps['for-you'];
    const humanArtTimestamp = this.globalLatestPostTimestamps['human-drawing'];
    
    // If we don't have timestamps for both tabs, load them first
    if (!forYouTimestamp || !humanArtTimestamp) {
      this.loadBothTabTimestamps().then(() => {
        // After loading timestamps, try the combined request again
        this.performGlobalNewPostsCheck();
      });
      return;
    }

    // Make a single request to check both tabs
    this.checkNewPostsBothTabs(forYouTimestamp, humanArtTimestamp).subscribe({
      next: (response: any) => {
        if (response.has_new_posts) {
          this.globalHasNewPosts = true;
          this.globalNewPostsCount = response.new_posts_count;
          
          // Get author information from the current posts
          const currentPosts = this.getCurrentPosts();
          if (currentPosts && currentPosts.length > 0) {
            // Get unique authors from the most recent posts (up to 3)
            const recentAuthors = currentPosts
              .slice(0, Math.min(3, currentPosts.length))
              .map(post => ({
                username: post.author.username,
                avatar: post.author.profile_picture
              }))
              .filter((author, index, arr) => 
                arr.findIndex(a => a.username === author.username) === index
              )
              .slice(0, 3);
            
            this.globalNewPostsAuthors = recentAuthors;
          } else {
            // Fallback if no posts available
            this.globalNewPostsAuthors = [
              { username: 'New posts', avatar: undefined }
            ];
          }
          
          // Update the observable
          this.newPostsState.next({
            hasNewPosts: this.globalHasNewPosts,
            newPostsCount: this.globalNewPostsCount,
            newPostsAuthors: this.globalNewPostsAuthors
          });
        }
      },
      error: (error) => {
        console.error('Error checking for new posts globally (both tabs):', error);
        // Fallback to individual requests on error
        this.performIndividualTabChecks();
      }
    });
  }

  /**
   * Load timestamps for both tabs to enable combined checking
   */
  private async loadBothTabTimestamps(): Promise<void> {
    const tabs: ('for-you' | 'human-drawing')[] = ['for-you', 'human-drawing'];
    
    // Load timestamps for any missing tabs
    for (const tab of tabs) {
      if (!this.globalLatestPostTimestamps[tab]) {
        await this.loadTabTimestamp(tab);
      }
    }
  }

  /**
   * Load timestamp for a specific tab
   */
  private loadTabTimestamp(tab: 'for-you' | 'human-drawing'): Promise<void> {
    return new Promise((resolve) => {
      // Get fresh data directly from the API, not using cached methods
      const postType = tab === 'human-drawing' ? 'human_drawing' : 'all';
      const followingOnly = localStorage.getItem('following_only_preference') === 'true';
      const url = `${this.baseUrl}/posts/feed/?page=1&post_type=${postType}&following_only=${followingOnly}`;
      
      this.http.get<PaginatedResponse>(url).pipe(
        take(1),
        map((response: PaginatedResponse) => {
          if (response && response.results && response.results.length > 0) {
            // Update the timestamp with the latest post from the user's actual timeline
            // But don't update the posts cache - this is just for timestamp baseline
            this.updateGlobalLatestPostTimestamp(tab, response.results);
          }
          resolve();
        }),
        catchError((error) => {
          console.error(`Error loading user timeline for timestamp (${tab}):`, error);
          resolve(); // Continue even if one tab fails
          return of(undefined);
        })
      ).subscribe();
    });
  }

  /**
   * Fallback method to check tabs individually
   */
  private performIndividualTabChecks(): void {
    const tabs: ('for-you' | 'human-drawing')[] = ['for-you', 'human-drawing'];
    
    tabs.forEach(tab => {
      const currentLatestTimestamp = this.globalLatestPostTimestamps[tab];
      
      if (!currentLatestTimestamp) {
        return; // No timestamp to compare against
      }

      this.checkNewPosts(currentLatestTimestamp, tab).subscribe({
        next: (response: any) => {
          if (response.has_new_posts) {
            this.globalHasNewPosts = true;
            this.globalNewPostsCount = response.new_posts_count;
            
            // Get author information from the current posts
            const currentPosts = this.getCurrentPosts();
            if (currentPosts && currentPosts.length > 0) {
              // Get unique authors from the most recent posts (up to 3)
              const recentAuthors = currentPosts
                .slice(0, Math.min(3, currentPosts.length))
                .map(post => ({
                  username: post.author.username,
                  avatar: post.author.profile_picture
                }))
                .filter((author, index, arr) => 
                  arr.findIndex(a => a.username === author.username) === index
                )
                .slice(0, 3);
              
              this.globalNewPostsAuthors = recentAuthors;
            } else {
              // Fallback if no posts available
              this.globalNewPostsAuthors = [
                { username: 'New posts', avatar: undefined }
              ];
            }
            
            // Update the observable
            this.newPostsState.next({
              hasNewPosts: this.globalHasNewPosts,
              newPostsCount: this.globalNewPostsCount,
              newPostsAuthors: this.globalNewPostsAuthors
            });
          }
        },
        error: (error) => {
          console.error(`Error checking for new posts globally (${tab}):`, error);
        }
      });
    });
  }

  /**
   * Update the latest post timestamp for a specific tab
   */
  public updateGlobalLatestPostTimestamp(tab: 'for-you' | 'human-drawing', posts: Post[]): void {
    if (posts.length > 0) {
      const latestPost = posts[0];
      // Use effective publication time: scheduled_time if exists, otherwise created_at
      const effectiveTime = latestPost.scheduled_time || latestPost.created_at;
      this.globalLatestPostTimestamps[tab] = effectiveTime;
    }
  }

  /**
   * Clear global new posts state (called when user clicks "Show new posts")
   */
  public clearGlobalNewPostsState(): void {
    this.globalHasNewPosts = false;
    this.globalNewPostsCount = 0;
    this.globalNewPostsAuthors = [];
    
    // Update the observable
    this.newPostsState.next({
      hasNewPosts: false,
      newPostsCount: 0,
      newPostsAuthors: []
    });
  }

  /**
   * Get current global new posts state
   */
  public getGlobalNewPostsState(): {
    hasNewPosts: boolean;
    newPostsCount: number;
    newPostsAuthors: Array<{ avatar?: string, username: string }>;
  } {
    return {
      hasNewPosts: this.globalHasNewPosts,
      newPostsCount: this.globalNewPostsCount,
      newPostsAuthors: this.globalNewPostsAuthors
    };
  }

  /**
   * Check if global new posts checking is currently running
   */
  public isGlobalNewPostsCheckRunning(): boolean {
    return this.globalNewPostsCheckInterval !== null;
  }

  /**
   * Get the current global latest post timestamps
   */
  public getGlobalLatestPostTimestamps(): { [key: string]: string | null } {
    return { ...this.globalLatestPostTimestamps };
  }

  /**
   * Cache profile data for a specific user and type
   */
  private cacheProfileData(cacheKey: string, data: { media: Post[]; humanArt: Post[]; likes: Post[] }): void {
    this.profileCache.set(cacheKey, {
      ...data,
      timestamp: Date.now()
    });
  }

  /**
   * Check if profile cache is still valid (less than 10 minutes old)
   */
  private isProfileCacheValid(cacheKey: string): boolean {
    const cached = this.profileCache.get(cacheKey);
    if (!cached) return false;
    
    const cacheAge = Date.now() - cached.timestamp;
    const maxAge = 10 * 60 * 1000; // 10 minutes
    return cacheAge < maxAge;
  }

  /**
   * Clear profile cache for a specific user
   */
  public clearProfileCache(handle: string): void {
    const keysToDelete = [
      `media_${handle}`,
      `humanArt_${handle}`,
      `likes_${handle}`
    ];
    
    keysToDelete.forEach(key => {
      this.profileCache.delete(key);
    });
  }

  /**
   * Clear all profile caches
   */
  public clearAllProfileCaches(): void {
    this.profileCache.clear();
  }

  /**
   * Check if profile data has cached content for a specific user and type
   */
  public hasCachedProfileData(handle: string, type: 'media' | 'humanArt' | 'likes'): boolean {
    const cacheKey = `${type}_${handle}`;
    return this.isProfileCacheValid(cacheKey);
  }

  /**
   * Check if user posts are cached
   */
  public hasCachedUserPosts(): boolean {
    return this.userPosts.getValue().length > 0;
  }

  /**
   * Check if user replies are cached
   */
  public hasCachedUserReplies(): boolean {
    return this.userReplies.getValue().length > 0;
  }
} 