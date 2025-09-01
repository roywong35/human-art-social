import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { Post } from '../models/post.model';
import { Comment } from '../models/comment.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BookmarkService {
  private apiUrl = environment.apiUrl;
  private baseApiUrl = `${environment.apiUrl}/api`;

  // Cache for bookmarked posts
  private bookmarkedPostsCache: {
    posts: Post[];
    timestamp: number;
  } | null = null;

  // Cache for bookmarked comments
  private bookmarkedCommentsCache: {
    comments: Comment[];
    timestamp: number;
  } | null = null;

  // Cache for processed bookmarked items (for instant display)
  private processedBookmarkedItemsCache: {
    items: any[];
    timestamp: number;
  } | null = null;

  constructor(private http: HttpClient) {}

  toggleBookmark(handle: string, postId: number): Observable<void> {
    return this.http.post<void>(`${this.baseApiUrl}/posts/${handle}/${postId}/bookmark/`, {}).pipe(
      tap(() => {
        // Clear cache when bookmark status changes
        this.clearBookmarkedPostsCache();
        this.clearProcessedBookmarkedItemsCache();
      })
    );
  }

  toggleCommentBookmark(handle: string, postId: number, commentId: number): Observable<void> {
    return this.http.post<void>(`${this.baseApiUrl}/posts/${handle}/post/${postId}/comments/${commentId}/bookmark/`, {}).pipe(
      tap(() => {
        // Clear cache when bookmark status changes
        this.clearBookmarkedCommentsCache();
        this.clearProcessedBookmarkedItemsCache();
      })
    );
  }

  getBookmarkedPosts(forceRefresh: boolean = false): Observable<Post[]> {
    // Check if we have valid cached data and don't need to force refresh
    if (!forceRefresh && this.isBookmarkedPostsCacheValid()) {
      return of(this.bookmarkedPostsCache!.posts);
    }

    return this.http.get<Post[]>(`${this.baseApiUrl}/bookmarks/posts/`).pipe(
      tap(posts => {
        // Cache the bookmarked posts
        this.cacheBookmarkedPosts(posts);
      })
    );
  }

  getBookmarkedComments(forceRefresh: boolean = false): Observable<Comment[]> {
    // Check if we have valid cached data and don't need to force refresh
    if (!forceRefresh && this.isBookmarkedCommentsCacheValid()) {
      return of(this.bookmarkedCommentsCache!.comments);
    }

    return this.http.get<Comment[]>(`${this.baseApiUrl}/bookmarks/comments/`).pipe(
      tap(comments => {
        // Cache the bookmarked comments
        this.cacheBookmarkedComments(comments);
      })
    );
  }

  /**
   * Get processed bookmarked items (posts + comments combined and sorted)
   * This method processes the data and caches the result for instant display
   */
  getProcessedBookmarkedItems(forceRefresh: boolean = false): Observable<any[]> {
    // Check if we have valid processed cache and don't need to force refresh
    if (!forceRefresh && this.isProcessedBookmarkedItemsCacheValid()) {
      return of(this.processedBookmarkedItemsCache!.items);
    }

    // Get bookmarked posts and process them
    return this.getBookmarkedPosts(forceRefresh).pipe(
      tap(posts => {
        // Process the posts into bookmarked items
        const processedItems = this.processBookmarkedItems(posts);
        this.cacheProcessedBookmarkedItems(processedItems);
      }),
      map((posts: Post[]) => {
        // Process the posts into bookmarked items
        return this.processBookmarkedItems(posts);
      })
    );
  }

  getUserBookmarkedPosts(handle: string): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseApiUrl}/users/${handle}/bookmarks/posts/`);
  }

  getUserBookmarkedComments(handle: string): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${this.baseApiUrl}/users/${handle}/bookmarks/comments/`);
  }

  /**
   * Cache bookmarked posts data
   */
  private cacheBookmarkedPosts(posts: Post[]): void {
    this.bookmarkedPostsCache = {
      posts: [...posts],
      timestamp: Date.now()
    };
  }

  /**
   * Cache bookmarked comments data
   */
  private cacheBookmarkedComments(comments: Comment[]): void {
    this.bookmarkedCommentsCache = {
      comments: [...comments],
      timestamp: Date.now()
    };
  }

  /**
   * Check if bookmarked posts cache is still valid (less than 10 minutes old)
   */
  private isBookmarkedPostsCacheValid(): boolean {
    if (!this.bookmarkedPostsCache) return false;
    
    const cacheAge = Date.now() - this.bookmarkedPostsCache.timestamp;
    const maxAge = 10 * 60 * 1000; // 10 minutes
    return cacheAge < maxAge;
  }

  /**
   * Check if bookmarked comments cache is still valid (less than 10 minutes old)
   */
  private isBookmarkedCommentsCacheValid(): boolean {
    if (!this.bookmarkedCommentsCache) return false;
    
    const cacheAge = Date.now() - this.bookmarkedCommentsCache.timestamp;
    const maxAge = 10 * 60 * 1000; // 10 minutes
    return cacheAge < maxAge;
  }

  /**
   * Clear bookmarked posts cache
   */
  public clearBookmarkedPostsCache(): void {
    this.bookmarkedPostsCache = null;
  }

  /**
   * Clear bookmarked comments cache
   */
  public clearBookmarkedCommentsCache(): void {
    this.bookmarkedCommentsCache = null;
  }

  /**
   * Clear all bookmark caches
   */
  public clearAllBookmarkCaches(): void {
    this.bookmarkedPostsCache = null;
    this.bookmarkedCommentsCache = null;
  }

  /**
   * Check if bookmarked posts have cached content
   */
  public hasCachedBookmarkedPosts(): boolean {
    return this.isBookmarkedPostsCacheValid();
  }

  /**
   * Check if bookmarked comments have cached content
   */
  public hasCachedBookmarkedComments(): boolean {
    return this.isBookmarkedCommentsCacheValid();
  }

  /**
   * Process bookmarked posts into a combined list of items
   */
  private processBookmarkedItems(posts: Post[]): any[] {
    const bookmarkedItems: any[] = [];
    
    posts.forEach(post => {
      // Only add posts that are explicitly bookmarked by the user
      if (post.is_bookmarked === true) {
        bookmarkedItems.push({
          type: 'post',
          item: post,
          bookmarked_at: (post as any).bookmarked_at || post.created_at
        });
      }
      
      // Add bookmarked comments
      const comments = (post as any).bookmarked_comments || [];
      if (comments.length > 0) {
        comments.forEach((comment: any) => {
          // Ensure the comment has the post ID
          comment.post_id = post.id;
          bookmarkedItems.push({
            type: 'comment',
            item: comment,
            bookmarked_at: comment.bookmarked_at || comment.created_at
          });
        });
      }
    });
    
    // Sort all items by bookmark time
    bookmarkedItems.sort((a, b) => 
      new Date(b.bookmarked_at).getTime() - new Date(a.bookmarked_at).getTime()
    );
    
    return bookmarkedItems;
  }

  /**
   * Cache processed bookmarked items
   */
  private cacheProcessedBookmarkedItems(items: any[]): void {
    this.processedBookmarkedItemsCache = {
      items: [...items],
      timestamp: Date.now()
    };
  }

  /**
   * Check if processed bookmarked items cache is still valid (less than 10 minutes old)
   */
  private isProcessedBookmarkedItemsCacheValid(): boolean {
    if (!this.processedBookmarkedItemsCache) return false;
    
    const cacheAge = Date.now() - this.processedBookmarkedItemsCache.timestamp;
    const maxAge = 10 * 60 * 1000; // 10 minutes
    return cacheAge < maxAge;
  }

  /**
   * Clear processed bookmarked items cache
   */
  public clearProcessedBookmarkedItemsCache(): void {
    this.processedBookmarkedItemsCache = null;
  }

  /**
   * Check if processed bookmarked items have cached content
   */
  public hasCachedProcessedBookmarkedItems(): boolean {
    return this.isProcessedBookmarkedItemsCacheValid();
  }
} 