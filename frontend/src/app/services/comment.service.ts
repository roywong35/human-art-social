import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Comment } from '../models/comment.model';

interface CommentResponse {
  comment: Comment;
  parent_chain: Comment[];
}

@Injectable({
  providedIn: 'root'
})
export class CommentService {
  private apiUrl = environment.apiUrl;
  private baseApiUrl = `${environment.apiUrl}/api`;

  constructor(private http: HttpClient) {}

  getComments(handle: string, postId: number): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${this.baseApiUrl}/posts/${handle}/post/${postId}/comments/`);
  }

  getComment(handle: string, postId: number, commentId: number): Observable<Comment> {
    return this.http.get<Comment>(`${this.baseApiUrl}/posts/${handle}/post/${postId}/comments/${commentId}/`);
  }

  getParentChain(handle: string, postId: number, commentId: number): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${this.baseApiUrl}/posts/${handle}/post/${postId}/comments/${commentId}/parent-chain/`);
  }

  createComment(handle: string, postId: number, content: string): Observable<Comment> {
    return this.http.post<Comment>(`${this.baseApiUrl}/posts/${handle}/post/${postId}/comments/`, { content });
  }

  createReply(handle: string, postId: number, commentId: number, content: string): Observable<Comment> {
    return this.http.post<Comment>(`${this.baseApiUrl}/posts/${handle}/post/${postId}/comments/${commentId}/replies/`, { content });
  }

  likeComment(handle: string, postId: number, commentId: number): Observable<void> {
    return this.http.post<void>(`${this.baseApiUrl}/posts/${handle}/post/${postId}/comments/${commentId}/like/`, {});
  }

  repostComment(handle: string, postId: number, commentId: number): Observable<void> {
    return this.http.post<void>(`${this.baseApiUrl}/posts/${handle}/post/${postId}/comments/${commentId}/repost/`, {});
  }

  bookmarkComment(handle: string, postId: number, commentId: number): Observable<void> {
    return this.http.post<void>(`${this.baseApiUrl}/posts/${handle}/post/${postId}/comments/${commentId}/bookmark/`, {});
  }

  getReplies(handle: string, postId: number, commentId: number): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${this.baseApiUrl}/posts/${handle}/post/${postId}/comments/${commentId}/replies/`);
  }

  getUserComments(handle: string): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${this.baseApiUrl}/users/${handle}/comments/`);
  }

  searchComments(query: string): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${this.baseApiUrl}/comments/search/`, {
      params: { q: query }
    });
  }
} 