import { Injectable, OnDestroy } from '@angular/core';
import { DraftService, ScheduledPost } from './draft.service';
import { PostService } from './post.service';
import { ToastService } from './toast.service';
import { Subscription, interval } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ScheduledPostService implements OnDestroy {
  private checkInterval = 30000; // Check every 30 seconds
  private intervalSubscription?: Subscription;

  constructor(
    private draftService: DraftService,
    private postService: PostService,
    private toastService: ToastService
  ) {
    this.startScheduledPostChecker();
  }

  ngOnDestroy(): void {
    this.stopScheduledPostChecker();
  }

  private startScheduledPostChecker(): void {
    // Check immediately
    this.checkAndPublishScheduledPosts();
    
    // Then check every 30 seconds
    this.intervalSubscription = interval(this.checkInterval).subscribe(() => {
      this.checkAndPublishScheduledPosts();
    });
  }

  private stopScheduledPostChecker(): void {
    if (this.intervalSubscription) {
      this.intervalSubscription.unsubscribe();
    }
  }

  private checkAndPublishScheduledPosts(): void {
    const scheduledPosts = this.draftService.getScheduledPosts();
    const now = new Date();

    scheduledPosts.forEach(scheduledPost => {
      if (scheduledPost.status === 'scheduled' && new Date(scheduledPost.scheduled_time) <= now) {
        this.publishScheduledPost(scheduledPost);
      }
    });
  }

  private async publishScheduledPost(scheduledPost: ScheduledPost): Promise<void> {
    try {
      console.log('Publishing scheduled post:', scheduledPost.id);
      
      // Use the DraftService's publishScheduledPost method which calls the backend API
      await this.draftService.publishScheduledPost(scheduledPost.id).toPromise();
      
      console.log('Scheduled post published successfully:', scheduledPost.id);
      this.toastService.showSuccess('Your scheduled post has been published!');
      
    } catch (error) {
      console.error('Error publishing scheduled post:', error);
      this.toastService.showError('Failed to publish scheduled post. Please try posting manually.');
    }
  }

  // Manual method to retry failed posts
  public retryFailedPost(scheduledPost: ScheduledPost): void {
    if (scheduledPost.status === 'failed') {
      // Try to publish the failed post using the backend API
      this.publishScheduledPost(scheduledPost);
    }
  }
} 