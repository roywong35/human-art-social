import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, map } from 'rxjs';
import { Post } from '../models/post.model';
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
    this.http.get<Post[]>(`${this.baseApiUrl}/feed/`).subscribe({
      next: (posts) => this.posts.next(posts.map(post => this.addImageUrls(post))),
      error: (error) => console.error('Error loading posts:', error)
    });
  }

  getPosts(): Observable<Post[]> {
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

  createPost(content: string, image?: File): Observable<Post> {
    console.log('Creating post with image:', image);
    const formData = new FormData();
    formData.append('content', content);
    if (image) {
      console.log('Appending image to form data:', {
        name: image.name,
        type: image.type,
        size: image.size
      });
      formData.append('image', image);
    }
    return this.http.post<Post>(`${this.baseApiUrl}/posts/`, formData).pipe(
      tap(response => console.log('Post creation response:', response)),
      map(post => this.addImageUrls(post))
    );
  }

  createPostWithFormData(formData: FormData): Observable<Post> {
    return this.http.post<Post>(`${this.baseApiUrl}/posts/`, formData).pipe(
      map(post => this.addImageUrls(post))
    );
  }

  likePost(handle: string, postId: number): Observable<void> {
    return this.http.post<void>(`${this.baseApiUrl}/posts/${handle}/${postId}/like/`, {});
  }

  repost(handle: string, postId: number): Observable<Post> {
    return this.http.post<Post>(`${this.baseApiUrl}/posts/${handle}/${postId}/repost/`, {}).pipe(
      map(post => this.addImageUrls(post))
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
    return this.http.post<void>(`${this.baseApiUrl}/posts/${handle}/${postId}/bookmark/`, {});
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

  private addImageUrls(post: Post): Post {
    console.log('Processing post:', post);
    if (post.image) {
      console.log('Original image path:', post.image);
      // If it's not an absolute URL and not a data URL, make it absolute
      if (!post.image.startsWith('http') && !post.image.startsWith('data:')) {
        const imagePath = post.image.startsWith('/') ? post.image : `/${post.image}`;
        post.image = `${this.apiUrl}${imagePath}`;
        console.log('Converted to absolute URL:', post.image);
      } else {
        // If it's already an absolute URL but points to our API, ensure it's accessible
        if (post.image.includes('localhost:8000')) {
          const url = new URL(post.image);
          post.image = `${this.apiUrl}${url.pathname}`;
          console.log('Normalized localhost URL:', post.image);
        }
      }
      console.log('Final image URL:', post.image);
    }
    
    if (post.author?.profile_picture) {
      if (!post.author.profile_picture.startsWith('http') && !post.author.profile_picture.startsWith('data:')) {
        const profilePath = post.author.profile_picture.startsWith('/') ? post.author.profile_picture : `/${post.author.profile_picture}`;
        post.author.profile_picture = `${this.apiUrl}${profilePath}`;
      } else if (post.author.profile_picture.includes('localhost:8000')) {
        const url = new URL(post.author.profile_picture);
        post.author.profile_picture = `${this.apiUrl}${url.pathname}`;
      }
    }
    return post;
  }
} 