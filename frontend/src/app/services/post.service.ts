import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, map } from 'rxjs';
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
    this.getFeed().subscribe({
      next: (posts) => this.posts.next(posts),
      error: (error) => console.error('Error loading posts:', error)
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
    console.log('Creating post with images:', images);
    const formData = new FormData();
    formData.append('content', content);
    
    if (images && images.length > 0) {
      images.forEach((image, index) => {
        console.log('Appending image to form data:', {
          name: image.name,
          type: image.type,
          size: image.size,
          index: index
        });
        formData.append('images[]', image, image.name);
      });
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
    return this.http.get<Post[]>(`${this.baseApiUrl}/posts/feed/`).pipe(
      map(posts => posts.map(post => this.addImageUrls(post)))
    );
  }

  getExplore(): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseApiUrl}/posts/explore/`).pipe(
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
    if (post.image) {
      if (!post.image.startsWith('http') && !post.image.startsWith('data:')) {
        const imagePath = post.image.startsWith('/') ? post.image : `/${post.image}`;
        post.image = `${this.apiUrl}${imagePath}`;
      }
    }
    
    if (post.author?.profile_picture) {
      if (!post.author.profile_picture.startsWith('http') && !post.author.profile_picture.startsWith('data:')) {
        const profilePath = post.author.profile_picture.startsWith('/') ? post.author.profile_picture : `/${post.author.profile_picture}`;
        post.author.profile_picture = `${this.apiUrl}${profilePath}`;
      }
    }

    if (post.images) {
      post.images = post.images.map(image => ({
        ...image,
        image: !image.image.startsWith('http') ? `${this.apiUrl}${image.image.startsWith('/') ? image.image : `/${image.image}`}` : image.image
      }));
    }
    return post;
  }
} 