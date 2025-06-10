import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Post } from '../models/post.model';
import { Comment } from '../models/comment.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BookmarkService {
  private apiUrl = environment.apiUrl;
  private baseApiUrl = `${environment.apiUrl}/api`;

  constructor(private http: HttpClient) {}

  toggleBookmark(handle: string, postId: number): Observable<void> {
    return this.http.post<void>(`${this.baseApiUrl}/posts/${handle}/${postId}/bookmark/`, {});
  }

  toggleCommentBookmark(handle: string, postId: number, commentId: number): Observable<void> {
    return this.http.post<void>(`${this.baseApiUrl}/posts/${handle}/post/${postId}/comments/${commentId}/bookmark/`, {});
  }

  getBookmarkedPosts(): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseApiUrl}/bookmarks/posts/`);
  }

  getBookmarkedComments(): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${this.baseApiUrl}/bookmarks/comments/`);
  }

  getUserBookmarkedPosts(handle: string): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseApiUrl}/users/${handle}/bookmarks/posts/`);
  }

  getUserBookmarkedComments(handle: string): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${this.baseApiUrl}/users/${handle}/bookmarks/comments/`);
  }
} 