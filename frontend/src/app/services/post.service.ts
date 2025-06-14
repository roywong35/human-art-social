import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, map, catchError, take } from 'rxjs';
import { Post, PostImage } from '../models/post.model';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class PostService {
  private apiUrl = environment.apiUrl;
  private baseApiUrl = `${environment.apiUrl}/api`;
  private posts = new BehaviorSubject<Post[]>([]);

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.loadPosts();
  }

  loadPosts(): void {
    console.log('Loading posts...');
    // Take the first value from currentUser$ to avoid multiple subscriptions
    this.authService.currentUser$.pipe(take(1)).subscribe(user => {
      console.log('Current user:', user);
      const request$ = user?.following_only_preference ? this.getFeed() : this.getExplore();
      request$.pipe(
        map(posts => posts.map(post => this.addImageUrls(post)))
      ).subscribe({
        next: (posts) => {
          console.log('Posts loaded:', posts.length);
          // Ensure we're not mutating the same array reference
          this.posts.next([...posts]);
        },
        error: (error) => {
          console.error('Error loading posts:', error);
          this.posts.next([]);
        }
      });
    });
  }

  get posts$(): Observable<Post[]> {
    return this.posts.asObservable();
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
    return this.http.post<Post>(`${this.baseApiUrl}/posts/`, formData).pipe(
      map(post => this.addImageUrls(post))
    );
  }

  createPostWithFormData(formData: FormData): Observable<Post> {
    return this.http.post<Post>(`${this.baseApiUrl}/posts/`, formData).pipe(
      map(post => this.addImageUrls(post)),
      tap(post => {
        const currentPosts = this.posts.getValue();
        this.posts.next([post, ...currentPosts]);
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

  getFeed(): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseApiUrl}/feed/`).pipe(
      map(posts => posts.map(post => this.addImageUrls(post)))
    );
  }

  getExplore(): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseApiUrl}/explore/`).pipe(
      map(posts => posts.map(post => this.addImageUrls(post)))
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

  private addImageUrls(post: Post): Post {
    // Create a new post object to avoid mutations
    const processedPost = { ...post };
    
    if (processedPost.image) {
      if (!processedPost.image.startsWith('http') && !processedPost.image.startsWith('data:')) {
        const imagePath = processedPost.image.startsWith('/') ? processedPost.image : `/${processedPost.image}`;
        processedPost.image = `${this.baseApiUrl}${imagePath}`;
      }
    }
    
    if (processedPost.author?.profile_picture) {
      if (!processedPost.author.profile_picture.startsWith('http') && !processedPost.author.profile_picture.startsWith('data:')) {
        const profilePath = processedPost.author.profile_picture.startsWith('/') ? processedPost.author.profile_picture : `/${processedPost.author.profile_picture}`;
        processedPost.author = {
          ...processedPost.author,
          profile_picture: `${this.baseApiUrl}${profilePath}`
        };
      }
    }

    if (processedPost.images) {
      processedPost.images = processedPost.images.map(image => ({
        ...image,
        image: !image.image.startsWith('http') ? `${this.baseApiUrl}${image.image.startsWith('/') ? image.image : `/${image.image}`}` : image.image
      }));
    }

    return processedPost;
  }
} 