import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Post } from '../models/post.model';

export interface DraftPost {
  id: string;
  content: string;
  images: any[]; // ImageFile array
  scheduledTime: Date | null;
  quotePost?: Post;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduledPost {
  id: string;
  content: string;
  images: any[];
  scheduledTime: Date;
  quotePost?: Post;
  createdAt: Date;
  status: 'scheduled' | 'sent' | 'failed';
}

@Injectable({
  providedIn: 'root'
})
export class DraftService {
  private readonly DRAFTS_STORAGE_KEY = 'post_drafts';
  private readonly SCHEDULED_STORAGE_KEY = 'scheduled_posts';

  private draftsSubject = new BehaviorSubject<DraftPost[]>([]);
  private scheduledPostsSubject = new BehaviorSubject<ScheduledPost[]>([]);

  public drafts$ = this.draftsSubject.asObservable();
  public scheduledPosts$ = this.scheduledPostsSubject.asObservable();

  constructor() {
    this.loadDrafts();
    this.loadScheduledPosts();
  }

  // Draft Posts Methods
  saveDraft(draft: Omit<DraftPost, 'id' | 'createdAt' | 'updatedAt'>): string {
    const drafts = this.getDrafts();
    const draftId = this.generateId();
    const now = new Date();

    const newDraft: DraftPost = {
      ...draft,
      id: draftId,
      createdAt: now,
      updatedAt: now
    };

    drafts.push(newDraft);
    this.saveDraftsToStorage(drafts);
    this.draftsSubject.next(drafts);

    return draftId;
  }

  updateDraft(draftId: string, updates: Partial<Omit<DraftPost, 'id' | 'createdAt'>>): boolean {
    const drafts = this.getDrafts();
    const draftIndex = drafts.findIndex(d => d.id === draftId);

    if (draftIndex === -1) {
      return false;
    }

    drafts[draftIndex] = {
      ...drafts[draftIndex],
      ...updates,
      updatedAt: new Date()
    };

    this.saveDraftsToStorage(drafts);
    this.draftsSubject.next(drafts);
    return true;
  }

  deleteDraft(draftId: string): boolean {
    const drafts = this.getDrafts();
    const filteredDrafts = drafts.filter(d => d.id !== draftId);

    if (filteredDrafts.length === drafts.length) {
      return false; // Draft not found
    }

    this.saveDraftsToStorage(filteredDrafts);
    this.draftsSubject.next(filteredDrafts);
    return true;
  }

  getDrafts(): DraftPost[] {
    return this.draftsSubject.value;
  }

  getDraft(draftId: string): DraftPost | null {
    return this.getDrafts().find(d => d.id === draftId) || null;
  }

  // Scheduled Posts Methods
  addScheduledPost(scheduledPost: Omit<ScheduledPost, 'id' | 'createdAt' | 'status'>): string {
    const scheduledPosts = this.getScheduledPosts();
    const postId = this.generateId();

    const newScheduledPost: ScheduledPost = {
      ...scheduledPost,
      id: postId,
      createdAt: new Date(),
      status: 'scheduled'
    };

    scheduledPosts.push(newScheduledPost);
    this.saveScheduledPostsToStorage(scheduledPosts);
    this.scheduledPostsSubject.next(scheduledPosts);

    return postId;
  }

  updateScheduledPostStatus(postId: string, status: ScheduledPost['status']): boolean {
    const scheduledPosts = this.getScheduledPosts();
    const postIndex = scheduledPosts.findIndex(p => p.id === postId);

    if (postIndex === -1) {
      return false;
    }

    scheduledPosts[postIndex].status = status;
    this.saveScheduledPostsToStorage(scheduledPosts);
    this.scheduledPostsSubject.next(scheduledPosts);
    return true;
  }

  deleteScheduledPost(postId: string): boolean {
    const scheduledPosts = this.getScheduledPosts();
    const filteredPosts = scheduledPosts.filter(p => p.id !== postId);

    if (filteredPosts.length === scheduledPosts.length) {
      return false; // Post not found
    }

    this.saveScheduledPostsToStorage(filteredPosts);
    this.scheduledPostsSubject.next(filteredPosts);
    return true;
  }

  getScheduledPosts(): ScheduledPost[] {
    return this.scheduledPostsSubject.value;
  }

  getScheduledPost(postId: string): ScheduledPost | null {
    return this.getScheduledPosts().find(p => p.id === postId) || null;
  }

  // Private Methods
  private loadDrafts(): void {
    try {
      const stored = localStorage.getItem(this.DRAFTS_STORAGE_KEY);
      if (stored) {
        const drafts = JSON.parse(stored).map((draft: any) => ({
          ...draft,
          createdAt: new Date(draft.createdAt),
          updatedAt: new Date(draft.updatedAt),
          scheduledTime: draft.scheduledTime ? new Date(draft.scheduledTime) : null
        }));
        this.draftsSubject.next(drafts);
      }
    } catch (error) {
      console.error('Error loading drafts:', error);
    }
  }

  private loadScheduledPosts(): void {
    try {
      const stored = localStorage.getItem(this.SCHEDULED_STORAGE_KEY);
      if (stored) {
        const scheduledPosts = JSON.parse(stored).map((post: any) => ({
          ...post,
          createdAt: new Date(post.createdAt),
          scheduledTime: new Date(post.scheduledTime)
        }));
        this.scheduledPostsSubject.next(scheduledPosts);
      }
    } catch (error) {
      console.error('Error loading scheduled posts:', error);
    }
  }

  private saveDraftsToStorage(drafts: DraftPost[]): void {
    try {
      localStorage.setItem(this.DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
    } catch (error) {
      console.error('Error saving drafts:', error);
    }
  }

  private saveScheduledPostsToStorage(scheduledPosts: ScheduledPost[]): void {
    try {
      localStorage.setItem(this.SCHEDULED_STORAGE_KEY, JSON.stringify(scheduledPosts));
    } catch (error) {
      console.error('Error saving scheduled posts:', error);
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
} 