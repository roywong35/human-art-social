import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, map, catchError, take } from 'rxjs';
import { Post, PostImage } from '../models/post.model';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

interface PaginatedResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Post[];
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

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  createPost(contentOrFormData: string | FormData, files?: File[]): Observable<Post> {
    if (contentOrFormData instanceof FormData) {
      return this.http.post<Post>(`${this.baseUrl}/posts/`, contentOrFormData).pipe(
        tap(newPost => {
          const currentPosts = this.posts.getValue();
          this.posts.next([newPost, ...currentPosts]);
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
    
    return this.http.post<Post>(`${this.baseUrl}/posts/`, formData).pipe(
      tap(newPost => {
        const currentPosts = this.posts.getValue();
        this.posts.next([newPost, ...currentPosts]);
      })
    );
  }

  loadPosts(refresh: boolean = false): void {
    // Always reset page number when loading posts initially
    this.currentPage = 1;
    this.hasMore = true;
    
    this.loading = true;
    console.log('Loading posts with auth state:', {
      isAuthenticated: this.authService.isAuthenticated(),
      currentPage: this.currentPage,
      activeTab: localStorage.getItem('activeTab')
    });

    const source = this.authService.isAuthenticated() ? this.getFeed() : this.getExplore();
    source.pipe(
      take(1)
    ).subscribe({
      next: (response: PaginatedResponse) => {
        console.log('Received response:', response);
        if (!response || !response.results) {
          console.error('Invalid response format:', response);
          this.posts.next([]);
          this.loading = false;
          return;
        }

        this.hasMore = !!response.next;
        this.posts.next(response.results || []);
        this.loading = false;
        // Only increment page number if there are more posts to load
        if (this.hasMore) {
          this.currentPage++;
        }
        console.log('Updated posts state:', {
          postsCount: response.results.length,
          hasMore: this.hasMore,
          currentPage: this.currentPage
        });
      },
      error: (error) => {
        console.error('Error loading posts:', error);
        this.loading = false;
        this.hasMore = false;
        this.posts.next([]);
      }
    });
  }

  private getFeed(): Observable<PaginatedResponse> {
    const activeTab = localStorage.getItem('activeTab') || 'for-you';
    const postType = activeTab === 'human-drawing' ? 'human_drawing' : 'all';
    return this.http.get<PaginatedResponse>(
      `${this.baseUrl}/posts/feed/?page=${this.currentPage}&post_type=${postType}`
    );
  }

  private getExplore(): Observable<PaginatedResponse> {
    const activeTab = localStorage.getItem('activeTab') || 'for-you';
    const postType = activeTab === 'human-drawing' ? 'human_drawing' : 'all';
    return this.http.get<PaginatedResponse>(
      `${this.baseUrl}/posts/explore/?page=${this.currentPage}&post_type=${postType}`
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

  getPost(handle: string, postId: number): Observable<Post> {
    return this.http.get<Post>(`${this.baseUrl}/posts/${handle}/${postId}/`).pipe(
      map(post => this.addImageUrls(post))
    );
  }

  getUserPosts(handle: string): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseUrl}/users/handle/${handle}/posts/`).pipe(
      map(posts => posts.map(post => this.addImageUrls(post)))
    );
  }

  createPostWithFormData(formData: FormData, isReply: boolean = false, handle?: string, postId?: number): Observable<Post> {
    const url = isReply && handle && postId 
      ? `${this.baseUrl}/posts/${handle}/${postId}/replies/`
      : `${this.baseUrl}/posts/`;
    
    // Debug FormData contents
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
      tap(newPost => {
        // Get current posts and add the new post only if it should be shown in current tab
        const currentPosts = this.posts.getValue();
        const activeTab = localStorage.getItem('activeTab') || 'for-you';
        
        if (activeTab === 'human-drawing' && newPost.is_human_drawing) {
          // Add to Human Art tab if it's a human drawing
          this.posts.next([newPost, ...currentPosts]);
        } else if (activeTab === 'for-you') {
          // Add to For You tab if it's not a human drawing or is verified
          if (!newPost.is_human_drawing || (newPost.is_human_drawing && newPost.is_verified)) {
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
    // Get current posts state
    const posts = this.posts.getValue();
    const post = posts.find(p => p.id === postId);
    if (!post) return new Observable();

    // Get the target post (original post for reposts)
    const targetPost = post.post_type === 'repost' && post.referenced_post ? post.referenced_post : post;
    const targetPostId = targetPost.id;

    // Optimistically update UI
    const newLikedState = !post.is_liked;
    const updatedPosts = posts.map(p => {
      // Update both the post and any related posts (original or reposts)
      const isRelatedPost = p.id === targetPostId || 
                          (p.post_type === 'repost' && p.referenced_post?.id === targetPostId) ||
                          (p.id === postId);
      
      if (isRelatedPost) {
        return {
          ...p,
          is_liked: newLikedState,
          likes_count: newLikedState ? p.likes_count + 1 : p.likes_count - 1
        };
      }
      return p;
    });
    this.posts.next(updatedPosts);

    // Send to backend using the target post's handle and ID
    return this.http.post<{liked: boolean}>(`${this.baseUrl}/posts/${targetPost.author.handle}/${targetPostId}/like/`, {}).pipe(
      catchError(error => {
        // Revert on error
        this.posts.next(posts);
        throw error;
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
    return this.http.get<Post[]>(`${this.baseUrl}/posts/search/`, {
      params: { q: query }
    }).pipe(
      map(posts => posts.map(post => this.addImageUrls(post)))
    );
  }

  bookmarkPost(handle: string, postId: number): Observable<void> {
    // Get current posts state
    const posts = this.posts.getValue();
    const post = posts.find(p => p.id === postId);
    if (!post) return new Observable();

    // Get the target post (original post for reposts)
    const targetPost = post.post_type === 'repost' && post.referenced_post ? post.referenced_post : post;
    const targetPostId = targetPost.id;

    // Optimistically update UI
    const newBookmarkedState = !post.is_bookmarked;
    const updatedPosts = posts.map(p => {
      // Update both the post and any related posts (original or reposts)
      const isRelatedPost = p.id === targetPostId || 
                          (p.post_type === 'repost' && p.referenced_post?.id === targetPostId) ||
                          (p.id === postId);
      
      if (isRelatedPost) {
        return {
          ...p,
          is_bookmarked: newBookmarkedState
        };
      }
      return p;
    });
    this.posts.next(updatedPosts);

    // Send to backend using the target post's handle and ID
    return this.http.post<void>(`${this.baseUrl}/posts/${targetPost.author.handle}/${targetPostId}/bookmark/`, {}).pipe(
      catchError(error => {
        // Revert on error
        this.posts.next(posts);
        throw error;
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
    this.getPosts().subscribe(posts => {
      this.posts.next(posts);
    });
  }

  getPosts(): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseUrl}/posts/`).pipe(
      map(posts => posts.map(post => this.addImageUrls(post)))
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
} 