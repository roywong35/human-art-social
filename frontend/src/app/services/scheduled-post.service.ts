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
      if (scheduledPost.status === 'scheduled' && new Date(scheduledPost.scheduledTime) <= now) {
        this.publishScheduledPost(scheduledPost);
      }
    });
  }

  private async publishScheduledPost(scheduledPost: ScheduledPost): Promise<void> {
    try {
      console.log('Publishing scheduled post:', scheduledPost.id);
      
      // Update status to prevent multiple publishing attempts
      this.draftService.updateScheduledPostStatus(scheduledPost.id, 'sent');

      // Create FormData for the post
      const formData = new FormData();
      formData.append('content', scheduledPost.content);

      // Add images if any
      if (scheduledPost.images && scheduledPost.images.length > 0) {
        // Note: This assumes images are stored as blobs or files in the scheduled post
        // You may need to adjust this based on how images are stored
        scheduledPost.images.forEach((image, index) => {
          if (image.file) {
            formData.append(`image_${index}`, image.file);
          }
        });
      }

      // Publish the post
      await this.postService.createPostWithFormData(formData, false).toPromise();
      
      console.log('Scheduled post published successfully:', scheduledPost.id);
      this.toastService.showSuccess('Your scheduled post has been published!');
      
      // Remove from scheduled posts after successful publishing
      this.draftService.deleteScheduledPost(scheduledPost.id);
      
    } catch (error) {
      console.error('Error publishing scheduled post:', error);
      
      // Mark as failed
      this.draftService.updateScheduledPostStatus(scheduledPost.id, 'failed');
      this.toastService.showError('Failed to publish scheduled post. Please try posting manually.');
    }
  }

  // Manual method to retry failed posts
  public retryFailedPost(scheduledPost: ScheduledPost): void {
    if (scheduledPost.status === 'failed') {
      // Reset status and try again
      this.draftService.updateScheduledPostStatus(scheduledPost.id, 'scheduled');
      this.publishScheduledPost(scheduledPost);
    }
  }
} 