import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Post } from '../models/post.model';

@Injectable({
  providedIn: 'root'
})
export class CommentService {
  private apiUrl = environment.apiUrl;
  private baseApiUrl = `${environment.apiUrl}/api`;

  constructor(private http: HttpClient) {}

  getComments(handle: string, postId: number): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseApiUrl}/posts/${handle}/${postId}/replies/`);
  }

  getComment(handle: string, postId: number, commentId: number): Observable<Post> {
    return this.http.get<Post>(`${this.baseApiUrl}/posts/${handle}/${postId}/replies/${commentId}/`);
  }

  getParentChain(handle: string, postId: number, commentId: number): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseApiUrl}/posts/${handle}/${commentId}/parent-chain/`);
  }

  createComment(handle: string, postId: number, content: string): Observable<Post> {
    return this.http.post<Post>(`${this.baseApiUrl}/posts/${handle}/${postId}/replies/`, { content });
  }

  createReply(handle: string, postId: number, commentId: number, content: string): Observable<Post> {
    return this.http.post<Post>(`${this.baseApiUrl}/posts/${handle}/${commentId}/replies/`, { content });
  }

  likeComment(handle: string, postId: number, commentId: number): Observable<void> {
    return this.http.post<void>(`${this.baseApiUrl}/posts/${handle}/${commentId}/like/`, {});
  }

  repostComment(handle: string, postId: number, commentId: number): Observable<void> {
    return this.http.post<void>(`${this.baseApiUrl}/posts/${handle}/${commentId}/repost/`, {});
  }

  bookmarkComment(handle: string, postId: number, commentId: number): Observable<void> {
    return this.http.post<void>(`${this.baseApiUrl}/posts/${handle}/${commentId}/bookmark/`, {});
  }

  getReplies(handle: string, postId: number, commentId: number): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseApiUrl}/posts/${handle}/${commentId}/replies/`);
  }

  getUserComments(handle: string): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseApiUrl}/posts/${handle}/`);
  }

  searchComments(query: string): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseApiUrl}/posts/search/`, {
      params: { q: query }
    });
  }
} 