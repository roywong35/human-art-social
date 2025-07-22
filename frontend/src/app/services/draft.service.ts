import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, map, catchError, of } from 'rxjs';
import { Post } from '../models/post.model';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface DraftPost {
  id: number;
  content: string;
  author: {
    id: number;
    username: string;
    handle: string;
    profile_picture?: string;
  };
  scheduled_time: string | null;
  quote_post?: Post;
  created_at: string;
  updated_at: string;
  post_type: 'post' | 'reply' | 'repost' | 'quote';
  parent_post?: number;
  is_human_drawing: boolean;
  images: {
    id: number;
    image: string;
    image_url: string;
    order: number;
    created_at: string;
  }[];
}

export interface ScheduledPost {
  id: number;
  content: string;
  author: {
    id: number;
    username: string;
    handle: string;
    profile_picture?: string;
  };
  scheduled_time: string;
  quote_post?: Post;
  created_at: string;
  updated_at: string;
  status: 'scheduled' | 'sent' | 'failed';
  status_display: string;
  post_type: 'post' | 'reply' | 'repost' | 'quote';
  parent_post?: number;
  is_human_drawing: boolean;
  images: {
    id: number;
    image: string;
    image_url: string;
    order: number;
    created_at: string;
  }[];
  published_post?: number;
  is_due: boolean;
}

export interface CreateDraftRequest {
  content: string;
  scheduled_time?: string | null;
  quote_post?: number;
  post_type?: 'post' | 'reply' | 'repost' | 'quote';
  parent_post?: number;
  is_human_drawing?: boolean;
}

export interface CreateScheduledPostRequest {
  content: string;
  scheduled_time: string;
  quote_post?: number;
  post_type?: 'post' | 'reply' | 'repost' | 'quote';
  parent_post?: number;
  is_human_drawing?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class DraftService {
  private baseUrl = environment.apiUrl + '/api';

  private draftsSubject = new BehaviorSubject<DraftPost[]>([]);
  private scheduledPostsSubject = new BehaviorSubject<ScheduledPost[]>([]);

  public drafts$ = this.draftsSubject.asObservable();
  public scheduledPosts$ = this.scheduledPostsSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    // Listen to authentication state changes and load data when user is authenticated
    this.authService.currentUser$.subscribe(user => {
      
      if (user) {
        this.loadDrafts();
        this.loadScheduledPosts();
      } else {
        this.draftsSubject.next([]);
        this.scheduledPostsSubject.next([]);
      }
    });
  }

  // Draft Posts Methods
  saveDraft(draftData: CreateDraftRequest, images?: File[]): Observable<DraftPost> {
    const formData = new FormData();
    
    // Add text data
    formData.append('content', draftData.content);
    if (draftData.scheduled_time) {
      formData.append('scheduled_time', draftData.scheduled_time);
    }
    if (draftData.quote_post) {
      formData.append('quote_post', draftData.quote_post.toString());
    }
    if (draftData.post_type) {
      formData.append('post_type', draftData.post_type);
    }
    if (draftData.parent_post) {
      formData.append('parent_post', draftData.parent_post.toString());
    }
    if (draftData.is_human_drawing !== undefined) {
      formData.append('is_human_drawing', draftData.is_human_drawing.toString());
    }

    // Add images
    if (images && images.length > 0) {
      images.forEach((image, index) => {
        formData.append(`image_${index}`, image);
      });
    }

    return this.http.post<DraftPost>(`${this.baseUrl}/drafts/`, formData).pipe(
      tap(newDraft => {
        const currentDrafts = this.draftsSubject.value;
        const draftsArray = Array.isArray(currentDrafts) ? currentDrafts : [];
        this.draftsSubject.next([newDraft, ...draftsArray]);
      }),
      catchError(error => {
        console.error('Error saving draft:', error);
        throw error;
      })
    );
  }

  updateDraft(draftId: number, draftData: Partial<CreateDraftRequest>, images?: File[]): Observable<DraftPost> {
    const formData = new FormData();
    
    // Add text data
    if (draftData.content !== undefined) {
      formData.append('content', draftData.content);
    }
    if (draftData.scheduled_time !== undefined) {
      if (draftData.scheduled_time) {
        formData.append('scheduled_time', draftData.scheduled_time);
      }
    }
    if (draftData.quote_post !== undefined) {
      formData.append('quote_post', draftData.quote_post.toString());
    }
    if (draftData.post_type !== undefined) {
      formData.append('post_type', draftData.post_type);
    }
    if (draftData.parent_post !== undefined) {
      formData.append('parent_post', draftData.parent_post.toString());
    }
    if (draftData.is_human_drawing !== undefined) {
      formData.append('is_human_drawing', draftData.is_human_drawing.toString());
    }

    // Add images if provided
    if (images && images.length > 0) {
      images.forEach((image, index) => {
        formData.append(`image_${index}`, image);
      });
    }

    return this.http.put<DraftPost>(`${this.baseUrl}/drafts/${draftId}/`, formData).pipe(
      tap(updatedDraft => {
        const currentDrafts = this.draftsSubject.value;
        const draftsArray = Array.isArray(currentDrafts) ? currentDrafts : [];
        const index = draftsArray.findIndex(d => d.id === draftId);
        if (index !== -1) {
          draftsArray[index] = updatedDraft;
          this.draftsSubject.next([...draftsArray]);
        }
      }),
      catchError(error => {
        console.error('Error updating draft:', error);
        throw error;
      })
    );
  }

  deleteDraft(draftId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/drafts/${draftId}/`).pipe(
      tap(() => {
        const currentDrafts = this.draftsSubject.value;
        const draftsArray = Array.isArray(currentDrafts) ? currentDrafts : [];
        const filteredDrafts = draftsArray.filter(d => d.id !== draftId);
    this.draftsSubject.next(filteredDrafts);
      }),
      catchError(error => {
        console.error('Error deleting draft:', error);
        throw error;
      })
    );
  }

  getDrafts(): DraftPost[] {
    const currentDrafts = this.draftsSubject.value;
    return Array.isArray(currentDrafts) ? currentDrafts : [];
  }

  getDraft(draftId: number): DraftPost | null {
    return this.getDrafts().find(d => d.id === draftId) || null;
  }

  publishDraft(draftId: number): Observable<Post> {
    return this.http.post<Post>(`${this.baseUrl}/drafts/${draftId}/publish/`, {}).pipe(
      tap(() => {
        // Remove the draft from the list since it's now published
        const currentDrafts = this.draftsSubject.value;
        const draftsArray = Array.isArray(currentDrafts) ? currentDrafts : [];
        const filteredDrafts = draftsArray.filter(d => d.id !== draftId);
        this.draftsSubject.next(filteredDrafts);
      }),
      catchError(error => {
        console.error('Error publishing draft:', error);
        throw error;
      })
    );
  }

  // Scheduled Posts Methods
  addScheduledPost(scheduledPostData: CreateScheduledPostRequest, images?: File[]): Observable<ScheduledPost> {
    const formData = new FormData();
    
    // Add text data
    formData.append('content', scheduledPostData.content);
    formData.append('scheduled_time', scheduledPostData.scheduled_time);
    if (scheduledPostData.quote_post) {
      formData.append('quote_post', scheduledPostData.quote_post.toString());
    }
    if (scheduledPostData.post_type) {
      formData.append('post_type', scheduledPostData.post_type);
    }
    if (scheduledPostData.parent_post) {
      formData.append('parent_post', scheduledPostData.parent_post.toString());
    }
    if (scheduledPostData.is_human_drawing !== undefined) {
      formData.append('is_human_drawing', scheduledPostData.is_human_drawing.toString());
    }

    // Add images
    if (images && images.length > 0) {
      images.forEach((image, index) => {
        formData.append(`image_${index}`, image);
      });
    }

    return this.http.post<ScheduledPost>(`${this.baseUrl}/scheduled-posts/`, formData).pipe(
      tap(newScheduledPost => {
        const currentScheduledPosts = this.scheduledPostsSubject.value;
        const scheduledPostsArray = Array.isArray(currentScheduledPosts) ? currentScheduledPosts : [];
        this.scheduledPostsSubject.next([newScheduledPost, ...scheduledPostsArray]);
      }),
      catchError(error => {
        console.error('Error creating scheduled post:', error);
        throw error;
      })
    );
  }

  updateScheduledPost(postId: number, scheduledPostData: Partial<CreateScheduledPostRequest>, images?: File[]): Observable<ScheduledPost> {
    const formData = new FormData();
    
    // Add text data
    if (scheduledPostData.content !== undefined) {
      formData.append('content', scheduledPostData.content);
    }
    if (scheduledPostData.scheduled_time !== undefined) {
      formData.append('scheduled_time', scheduledPostData.scheduled_time);
    }
    if (scheduledPostData.quote_post !== undefined) {
      formData.append('quote_post', scheduledPostData.quote_post.toString());
    }
    if (scheduledPostData.post_type !== undefined) {
      formData.append('post_type', scheduledPostData.post_type);
    }
    if (scheduledPostData.parent_post !== undefined) {
      formData.append('parent_post', scheduledPostData.parent_post.toString());
    }
    if (scheduledPostData.is_human_drawing !== undefined) {
      formData.append('is_human_drawing', scheduledPostData.is_human_drawing.toString());
    }

    // Add images if provided
    if (images && images.length > 0) {
      images.forEach((image, index) => {
        formData.append(`image_${index}`, image);
      });
    }

    return this.http.put<ScheduledPost>(`${this.baseUrl}/scheduled-posts/${postId}/`, formData).pipe(
      tap(updatedScheduledPost => {
        const currentScheduledPosts = this.scheduledPostsSubject.value;
        const scheduledPostsArray = Array.isArray(currentScheduledPosts) ? currentScheduledPosts : [];
        const index = scheduledPostsArray.findIndex(p => p.id === postId);
        if (index !== -1) {
          scheduledPostsArray[index] = updatedScheduledPost;
          this.scheduledPostsSubject.next([...scheduledPostsArray]);
        }
      }),
      catchError(error => {
        console.error('Error updating scheduled post:', error);
        throw error;
      })
    );
  }

  deleteScheduledPost(postId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/scheduled-posts/${postId}/`).pipe(
      tap(() => {
        const currentScheduledPosts = this.scheduledPostsSubject.value;
        const scheduledPostsArray = Array.isArray(currentScheduledPosts) ? currentScheduledPosts : [];
        const filteredScheduledPosts = scheduledPostsArray.filter(p => p.id !== postId);
        this.scheduledPostsSubject.next(filteredScheduledPosts);
      }),
      catchError(error => {
        console.error('Error deleting scheduled post:', error);
        throw error;
      })
    );
  }

  publishScheduledPost(postId: number): Observable<Post> {
    return this.http.post<Post>(`${this.baseUrl}/scheduled-posts/${postId}/publish_now/`, {}).pipe(
      tap(() => {
        // Update the scheduled post status
        const currentScheduledPosts = this.scheduledPostsSubject.value;
        const scheduledPostsArray = Array.isArray(currentScheduledPosts) ? currentScheduledPosts : [];
        const index = scheduledPostsArray.findIndex(p => p.id === postId);
        if (index !== -1) {
          scheduledPostsArray[index] = { 
            ...scheduledPostsArray[index], 
            status: 'sent' 
          };
          this.scheduledPostsSubject.next([...scheduledPostsArray]);
        }
      }),
      catchError(error => {
        console.error('Error publishing scheduled post:', error);
        throw error;
      })
    );
  }

  getScheduledPosts(): ScheduledPost[] {
    const currentScheduledPosts = this.scheduledPostsSubject.value;
    return Array.isArray(currentScheduledPosts) ? currentScheduledPosts : [];
  }

  getScheduledPost(postId: number): ScheduledPost | null {
    return this.getScheduledPosts().find(p => p.id === postId) || null;
  }

  getDueScheduledPosts(): Observable<ScheduledPost[]> {
    return this.http.get<ScheduledPost[]>(`${this.baseUrl}/scheduled-posts/due/`).pipe(
      catchError(error => {
        console.error('Error fetching due scheduled posts:', error);
        return of([]);
      })
    );
  }

  // Public method to manually reload drafts (useful for debugging)
  public reloadData(): void {
    this.loadDrafts();
    this.loadScheduledPosts();
  }

  // Private Methods
  private loadDrafts(): void {
    this.http.get<any>(`${this.baseUrl}/drafts/`).pipe(
      map(response => {
        // Handle both paginated and array responses
        if (response && typeof response === 'object' && 'results' in response) {
          return response.results || [];
        }
        return Array.isArray(response) ? response : [];
      }),
      catchError(error => {
        console.error('Error loading drafts:', error);
        return of([]);
      })
    ).subscribe(drafts => {
        this.draftsSubject.next(drafts);
    });
  }

  private loadScheduledPosts(): void {
    this.http.get<any>(`${this.baseUrl}/scheduled-posts/`).pipe(
      map(response => {
        // Handle both paginated and array responses
        if (response && typeof response === 'object' && 'results' in response) {
          return response.results || [];
        }
        return Array.isArray(response) ? response : [];
      }),
      catchError(error => {
        console.error('Error loading scheduled posts:', error);
        return of([]);
      })
    ).subscribe(scheduledPosts => {
        this.scheduledPostsSubject.next(scheduledPosts);
    });
  }

  // Helper method for converting legacy data structure
  convertLegacyDraftToApi(legacyDraft: {
    content: string;
    images: any[];
    scheduledTime: Date | null;
    quotePost?: Post;
  }): { data: CreateDraftRequest; images: File[] } {
    const data: CreateDraftRequest = {
      content: legacyDraft.content,
      scheduled_time: legacyDraft.scheduledTime?.toISOString() || null,
      quote_post: legacyDraft.quotePost?.id
    };

    // Extract File objects from legacy images array
    const images: File[] = [];
    if (legacyDraft.images) {
      legacyDraft.images.forEach(imageItem => {
        if (imageItem.file instanceof File) {
          images.push(imageItem.file);
        }
      });
    }

    return { data, images };
  }
} 