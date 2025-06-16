import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
  private apiUrl = environment.apiUrl;
  private baseApiUrl = `${environment.apiUrl}/api`;
  private posts = new BehaviorSubject<Post[]>([]);
  private currentPage = 1;
  private loading = false;
  private hasMore = true;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.loadPosts();
  }

  loadPosts(refresh: boolean = false): void {
    if (refresh) {
      this.currentPage = 1;
      this.hasMore = true;
      this.posts.next([]);
    }

    if (this.loading || !this.hasMore) {
      this.loading = false;
      return;
    }
    
    this.loading = true;
    console.log('Loading posts...');
    
    this.authService.currentUser$.pipe(take(1)).subscribe({
      next: user => {
        console.log('Current user:', user);
        const request$ = user?.following_only_preference ? this.getFeed() : this.getExplore();
        
        request$.pipe(
          map(response => {
            if (!response || !response.results) {
              console.error('Invalid response format:', response);
              throw new Error('Invalid response format from server');
            }
            
            // Update pagination state
            this.hasMore = !!response.next;
            this.currentPage++;
            
            const posts = response.results.map(post => this.addImageUrls(post));
            console.log('Raw posts from API:', posts);
            
            // Log all human art posts
            const humanArtPosts = posts.filter(p => p.is_human_drawing);
            console.log('Human art posts before processing:', humanArtPosts.map(p => ({
              id: p.id,
              is_human_drawing: p.is_human_drawing,
              is_verified: p.is_verified
            })));
            
            return posts;
          }),
          map(posts => {
            const activeTab = localStorage.getItem('activeTab') || 'for-you';
            console.log('Active tab:', activeTab);
            console.log('Posts before filtering:', posts.length);
            
            const filteredPosts = this.filterPostsByTab(posts);
            console.log('Posts after filtering:', filteredPosts.length);
            
            return filteredPosts;
          })
        ).subscribe({
          next: (posts) => {
            console.log('Final posts loaded:', posts.length);
            // Append new posts to existing ones
            const currentPosts = refresh ? [] : this.posts.getValue();
            this.posts.next([...currentPosts, ...posts]);
            this.loading = false;
          },
          error: (error) => {
            console.error('Error loading posts:', error);
            if (refresh) {
              this.posts.next([]);
            }
            this.loading = false;
            this.hasMore = false;
          }
        });
      },
      error: () => {
        this.loading = false;
        this.hasMore = false;
      }
    });
  }

  loadMorePosts(): void {
    if (!this.loading && this.hasMore) {
      this.loadPosts();
    }
  }

  get posts$(): Observable<Post[]> {
    return this.posts.asObservable();
  }

  get isLoading(): boolean {
    return this.loading;
  }

  get hasMorePosts(): boolean {
    return this.hasMore;
  }

  private getFeed(): Observable<PaginatedResponse> {
    return this.http.get<PaginatedResponse>(`${this.baseApiUrl}/posts/feed/?page=${this.currentPage}`);
  }

  private getExplore(): Observable<PaginatedResponse> {
    return this.http.get<PaginatedResponse>(`${this.baseApiUrl}/posts/explore/?page=${this.currentPage}`);
  }

  getPost(handle: string, postId: number): Observable<Post> {
    return this.http.get<Post>(`${this.baseApiUrl}/posts/${handle}/${postId}/`).pipe(
      map(post => this.addImageUrls(post))
    );
  }

  getUserPosts(handle: string): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseApiUrl}/users/handle/${handle}/posts/`).pipe(
      map(posts => posts.map(post => this.addImageUrls(post)))
    );
  }

  createPost(content: string, images?: File[]): Observable<Post> {
    const formData = new FormData();
    formData.append('content', content);
    if (images) {
      images.forEach((image, index) => {
        formData.append(`image_${index}`, image);
      });
    }
    console.log("formData2222: ", formData);
    return this.http.post<Post>(`${this.baseApiUrl}/posts/`, formData).pipe(
      map(post => this.addImageUrls(post)),
      tap(newPost => {
        // Get current posts and add the new post only if it should be shown in current tab
        const currentPosts = this.posts.getValue();
        const activeTab = localStorage.getItem('activeTab') || 'for-you';
        
        if (activeTab === 'human-drawing' && newPost.is_human_drawing) {
          // Add to Human Art tab if it's a human drawing
          this.posts.next([newPost, ...currentPosts]);
        } else if (activeTab === 'for-you' && (!newPost.is_human_drawing || newPost.is_verified)) {
          // Add to For You tab if it's not a human drawing or is verified
          this.posts.next([newPost, ...currentPosts]);
        }
      })
    );
  }

  createPostWithFormData(formData: FormData, isReply: boolean = false, handle?: string, postId?: number): Observable<Post> {
    const url = isReply && handle && postId 
      ? `${this.baseApiUrl}/posts/${handle}/${postId}/replies/`
      : `${this.baseApiUrl}/posts/`;
    
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
        } else if (activeTab === 'for-you' && (!newPost.is_human_drawing || newPost.is_verified)) {
          // Add to For You tab if it's not a human drawing or is verified
          this.posts.next([newPost, ...currentPosts]);
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
    return this.http.post<Post>(`${this.baseApiUrl}/posts/${handle}/${postId}/quote/`, formData).pipe(
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
    return this.http.post<{liked: boolean}>(`${this.baseApiUrl}/posts/${targetPost.author.handle}/${targetPostId}/like/`, {}).pipe(
      catchError(error => {
        // Revert on error
        this.posts.next(posts);
        throw error;
      })
    );
  }

  repost(handle: string, postId: number): Observable<Post> {
    return this.http.post<Post>(`${this.baseApiUrl}/posts/${handle}/${postId}/repost/`, {}).pipe(
      map(post => this.addImageUrls(post))
    );
  }

  repostPost(authorHandle: string, postId: string): Observable<{reposted: boolean}> {
    // Get current posts state
    const posts = this.posts.getValue();
    const post = posts.find(p => p.id === parseInt(postId));
    if (!post) return new Observable();

    console.log('Current post in service - is_reposted:', post.is_reposted);
    console.log('Full current post:', JSON.stringify(post, null, 2));

    // Get the target post (original post for reposts)
    const targetPost = post.post_type === 'repost' && post.referenced_post ? post.referenced_post : post;
    const targetPostId = targetPost.id.toString();
    console.log('Target post - is_reposted:', targetPost.is_reposted);

    // Optimistically update UI
    console.log('Updating UI optimistically...');
    const updatedPosts = posts.map(p => {
      // Update both the post and any related posts (original or reposts)
      const isRelatedPost = p.id === targetPost.id || 
                          (p.post_type === 'repost' && p.referenced_post?.id === targetPost.id) ||
                          (p.id === post.id);
      
      if (isRelatedPost) {
        console.log('Updating related post:', p.id, 'is_reposted:', p.is_reposted);
        const updatedPost = {
          ...p,
          is_reposted: !p.is_reposted,
          reposts_count: p.is_reposted ? p.reposts_count - 1 : p.reposts_count + 1
        };
        console.log('Updated post - is_reposted:', updatedPost.is_reposted);
        return updatedPost;
      }
      return p;
    });
    this.posts.next(updatedPosts);

    // Send to backend using the target post's handle and ID
    console.log('Sending request to backend...');
    return this.http.post<{reposted: boolean}>(`${this.baseApiUrl}/posts/${targetPost.author.handle}/${targetPostId}/repost/`, {}).pipe(
      tap(response => {
        console.log('Backend response:', response);
        console.log('Posts after update:', JSON.stringify(this.posts.getValue(), null, 2));
      }),
      catchError(error => {
        console.error('Error from backend:', error);
        // Revert on error
        this.posts.next(posts);
        throw error;
      })
    );
  }

  quotePost(handle: string, postId: number, content: string, image?: File): Observable<Post> {
    const formData = new FormData();
    formData.append('content', content);
    if (image) {
      formData.append('image', image);
    }
    return this.http.post<Post>(`${this.baseApiUrl}/posts/${handle}/post/${postId}/quote/`, formData).pipe(
      map(post => this.addImageUrls(post))
    );
  }

  getBookmarkedPosts(handle: string): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseApiUrl}/posts/${handle}/bookmarks/`).pipe(
      map(posts => posts.map(post => this.addImageUrls(post)))
    );
  }

  getLikedPosts(handle: string): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseApiUrl}/posts/${handle}/liked/`).pipe(
      map(posts => posts.map(post => this.addImageUrls(post)))
    );
  }

  getMediaPosts(handle: string): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseApiUrl}/posts/${handle}/media/`).pipe(
      map(posts => posts.map(post => this.addImageUrls(post)))
    );
  }

  searchPosts(query: string): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseApiUrl}/posts/search/`, {
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
    return this.http.post<void>(`${this.baseApiUrl}/posts/${targetPost.author.handle}/${targetPostId}/bookmark/`, {}).pipe(
      catchError(error => {
        // Revert on error
        this.posts.next(posts);
        throw error;
      })
    );
  }

  deletePost(handle: string, postId: number): Observable<any> {
    return this.http.delete(`${this.baseApiUrl}/posts/${handle}/post/${postId}/`).pipe(
      tap(() => {
        const currentPosts = this.posts.value;
        const updatedPosts = currentPosts.filter(post => post.id !== postId);
        this.posts.next(updatedPosts);
      })
    );
  }

  getUserPostsByHandle(handle: string): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseApiUrl}/posts/${handle}/`).pipe(
      map(posts => posts.map(post => this.addImageUrls(post)))
    );
  }

  verifyHumanArt(handle: string, postId: number): Observable<Post> {
    return this.http.post<Post>(`${this.baseApiUrl}/posts/${handle}/post/${postId}/verify_drawing/`, {}).pipe(
      map(post => this.addImageUrls(post))
    );
  }

  // Add this method to load a single post and update its state
  refreshPost(authorHandle: string, postId: number): Observable<Post> {
    return this.http.get<Post>(`${this.baseApiUrl}/posts/${authorHandle}/${postId}/`).pipe(
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
    return this.http.get<Post[]>(`${this.baseApiUrl}/posts/`).pipe(
      map(posts => posts.map(post => this.addImageUrls(post)))
    );
  }

  createReplyWithFormData(handle: string, postId: number, formData: FormData): Observable<Post> {
    const url = `${this.baseApiUrl}/posts/${handle}/${postId}/replies/`;
    
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
    return this.http.post<Post>(`${this.baseApiUrl}/posts/${handle}/${postId}/replies/`, formData).pipe(
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
        processedPost.image = `${this.baseApiUrl}${imagePath}`;
        console.log('Single image after processing:', processedPost.image);
      }
    }
    
    if (processedPost.author?.profile_picture) {
      console.log('Profile picture before processing:', processedPost.author.profile_picture);
      if (!processedPost.author.profile_picture.startsWith('http') && !processedPost.author.profile_picture.startsWith('data:')) {
        const profilePath = processedPost.author.profile_picture.startsWith('/') ? processedPost.author.profile_picture : `/${processedPost.author.profile_picture}`;
        processedPost.author = {
          ...processedPost.author,
          profile_picture: `${this.baseApiUrl}${profilePath}`
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
          image: !image.image.startsWith('http') ? `${this.baseApiUrl}${image.image.startsWith('/') ? image.image : `/${image.image}`}` : image.image
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
} 