import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, GroupedNotification } from '../../../services/notification.service';
import { Router, RouterModule } from '@angular/router';
import { TimeAgoPipe } from '../../../pipes/time-ago.pipe';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PostRemovalDialogComponent } from '../../dialogs/post-removal-dialog/post-removal-dialog.component';
import { Post } from '../../../models/post.model';
import { GlobalModalService } from '../../../services/global-modal.service';
import { Subscription } from 'rxjs';
import { ReportStatusDialogComponent } from '../../dialogs/report-status-dialog/report-status-dialog.component';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, TimeAgoPipe, RouterModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss']
})
export class NotificationsComponent implements OnInit, OnDestroy {
  notifications: GroupedNotification[] = [];
  loading = true;
  loadingMore = false; // Added for infinite scroll
  currentPage = 1;
  hasMore = false;
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';
  
  // User preview modal
  private hoverTimeout: any;
  private leaveTimeout: any;
  private lastHoveredElement: Element | null = null;
  private scrollThrottleTimeout: any; // Added for scroll throttling
  
  private subscriptions: Subscription[] = [];

  constructor(
    private notificationService: NotificationService,
    private router: Router,
    private dialog: MatDialog,
    private globalModalService: GlobalModalService
  ) {
    console.log('🔔 NotificationsComponent initialized');
    
    // Subscribe to global notifications list (similar to chat service)
    const notificationsSub = this.notificationService.notifications$.subscribe({
      next: (notifications) => {
        console.log('🔔 Global notifications updated:', notifications);
        this.notifications = notifications;
      },
      error: (error) => {
        console.error('🔔 NotificationsComponent: Error in global notifications subscription:', error);
      }
    });
    this.subscriptions.push(notificationsSub);
  }

  ngOnInit() {
    console.log('🔔 NotificationsComponent ngOnInit');
    // Only load notifications if user is authenticated
    this.notificationService.unreadCount$.subscribe(count => {
      if (count !== undefined) {
        console.log('🔔 User authenticated, loading notifications');
        this.loadNotifications();
      }
    });
  }

  ngOnDestroy() {
    // Clean up all subscriptions to prevent memory leaks
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
    
    // Clean up scroll throttle timeout
    if (this.scrollThrottleTimeout) {
      clearTimeout(this.scrollThrottleTimeout);
    }
  }

  loadNotifications() {
    this.loading = true;
    this.notificationService.getNotifications(this.currentPage).subscribe({
      next: (response) => {
        console.log('🔔 Notifications loaded:', response.results);
        // Update local notifications array as fallback
        if (this.currentPage === 1) {
          this.notifications = response.results;
        } else {
          this.notifications = [...this.notifications, ...response.results];
        }
        this.hasMore = response.results.length === 20; // 20 notifications per page as requested
        this.loading = false;
      },
      error: (error) => {
        console.error('❌ Error loading notifications:', error);
        this.loading = false;
      }
    });
  }

  loadMore() {
    if (this.loadingMore) return; // Prevent multiple simultaneous loads
    
    this.loadingMore = true;
    this.currentPage++;
    
    this.notificationService.getNotifications(this.currentPage).subscribe({
      next: (response) => {
        console.log('🔔 More notifications loaded:', response.results);
        // Update local notifications array
        this.notifications = [...this.notifications, ...response.results];
        this.hasMore = response.results.length === 20; // 20 notifications per page as requested
        this.loadingMore = false;
      },
      error: (error) => {
        console.error('❌ Error loading more notifications:', error);
        this.loadingMore = false;
        this.currentPage--; // Revert page increment on error
      }
    });
  }

  markAllAsRead() {
    // Reset unread count immediately
    this.notificationService.resetUnreadCount();

    // Make the backend call (service will update global list)
    this.notificationService.markAllAsRead().subscribe({
      error: () => {
        // Revert changes if the backend call fails
        this.loadNotifications();
        this.notificationService.loadUnreadCount();
      }
    });
  }

  markGroupAsRead(notification: GroupedNotification) {
    if (!notification.is_read) {
      // Mark the entire group as read
      this.notificationService.markGroupAsRead(notification.notification_ids).subscribe({
        error: () => {
          // Handle error if needed
        }
      });
    }
  }

  onNotificationClick(notification: GroupedNotification) {

    this.markGroupAsRead(notification);

    // Navigate based on notification type
    switch (notification.notification_type) {
      case 'like':
      case 'comment':
      case 'repost':
        if (notification.post?.id && notification.post?.author?.handle) {
          this.router.navigate(['/', notification.post.author.handle, 'post', notification.post.id]);
        }
        break;
      case 'follow':
        if (notification.users.length > 0) {
          this.router.navigate(['/', notification.users[0].handle]);
        }
        break;
      case 'report_received':
        // Show simple popup for report received
        this.showReportDialog();
        break;
      case 'post_removed':
        // Show post removal dialog with appeal options
        this.showPostRemovalDialog(notification);
        break;
      case 'appeal_approved':
        // Navigate to the restored post
        if (notification.post?.id && notification.post?.author?.handle) {

          this.router.navigate(['/', notification.post.author.handle, 'post', notification.post.id]);
        }
        break;
      case 'appeal_rejected':
        // Navigate to appeals page to view status
        this.router.navigate(['/appeals']);
        break;
      case 'art_verified':
        // Navigate to the verified art post
        if (notification.post?.id && notification.post?.author?.handle) {

          this.router.navigate(['/', notification.post.author.handle, 'post', notification.post.id]);
        }
        break;
      case 'donation':
        // Navigate to the post that received the donation
        if (notification.post?.id && notification.post?.author?.handle) {
          this.router.navigate(['/', notification.post.author.handle, 'post', notification.post.id]);
        }
        break;
    }
  }

  private showReportDialog() {

    
    // Use the exact same approach as create post modal
    const dialogRef = this.dialog.open(ReportStatusDialogComponent, {
      panelClass: ['report-status-dialog']
    });
    

    
    dialogRef.afterClosed().subscribe(result => {

    });
  }

  private showPostRemovalDialog(notification: GroupedNotification) {

    
    if (!notification.post) {
      console.error('No post data in notification');
      return;
    }

    // Use the notification post directly (it contains all necessary fields)
    const post = notification.post as Post;

    const dialogRef = this.dialog.open(PostRemovalDialogComponent, {
      panelClass: ['post-removal-dialog'],
      maxWidth: '100vw',
      maxHeight: '100vh',
      width: '100vw',
      height: '100vh',
      disableClose: false,
      hasBackdrop: true,
      data: {
        postId: notification.post.id,
        postHandle: notification.post.author.handle,
        post: post
      }
    });
    

    
    dialogRef.afterClosed().subscribe(result => {

    });
  }

  getSystemNotificationStyle(notificationType: string): string {
    switch (notificationType) {
      case 'post_removed':
        return 'bg-red-500';
      case 'report_received':
        return 'bg-blue-500';
      case 'appeal_approved':
        return 'bg-green-500';
      case 'appeal_rejected':
        return 'bg-red-500';
      case 'art_verified':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  }

  getSystemNotificationIcon(notificationType: string): string {
    switch (notificationType) {
      case 'post_removed':
        return 'fas fa-exclamation text-white text-sm';
      case 'report_received':
        return 'fas fa-check text-white text-sm';
      case 'appeal_approved':
        return 'fas fa-check-circle text-white text-sm';
      case 'appeal_rejected':
        return 'fas fa-times-circle text-white text-sm';
      case 'art_verified':
        return 'fas fa-certificate text-white text-sm';
      default:
        return 'fas fa-info text-white text-sm';
    }
  }

  // User preview modal methods
  protected onUserHover(event: MouseEvent, user: any): void {
    if (!user) return;
    
    // Clear any pending timeouts
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }
    if (this.leaveTimeout) {
      clearTimeout(this.leaveTimeout);
    }

    this.hoverTimeout = setTimeout(() => {
      // Store the hovered element for accurate positioning
      this.lastHoveredElement = event.target as Element;
      

      
      // Use the new accurate positioning method (no shifting!)
      this.globalModalService.showUserPreviewAccurate(user, this.lastHoveredElement);
    }, 300); // 300ms delay - faster than Twitter
  }

  protected onUserHoverLeave(): void {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }
    
    // Longer delay to allow moving to the modal
    this.leaveTimeout = setTimeout(() => {
      this.globalModalService.hideUserPreview();
    }, 300); // 300ms delay to allow moving to modal
  }

  protected onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = this.defaultAvatar;
    }
  }

  protected getFormattedDate(dateString: string): string {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    };
    
    return date.toLocaleString('en-US', options);
  }

  protected onModalHover(): void {
    // When hovering over the modal, cancel any pending close
    if (this.leaveTimeout) {
      clearTimeout(this.leaveTimeout);
    }
    this.globalModalService.onModalHover();
  }

  protected getActionText(notificationType: string): string {
    switch (notificationType) {
      case 'like':
        return 'liked your post';
      case 'comment':
        return 'commented on your post';
      case 'follow':
        return 'followed you';
      case 'repost':
        return 'reposted your post';
      case 'donation':
        return 'donated to your post';
      default:
        return '';
    }
  }

  protected getSystemMessage(notificationType: string): string {
    switch (notificationType) {
      case 'report_received':
        return 'We received your report';
      case 'post_removed':
        return 'Your post has been removed';
      case 'appeal_approved':
        return 'Your appeal has been approved and your post restored';
      case 'appeal_rejected':
        return 'Your appeal has been rejected';
      case 'art_verified':
        return 'Congrats! Your art has been verified';
      default:
        return '';
    }
  }

  protected getNotificationIcon(notificationType: string): string {
    switch (notificationType) {
      case 'like':
        return 'fas fa-heart';
      case 'comment':
        return 'fas fa-comment';
      case 'follow':
        return 'fas fa-user-plus';
      case 'repost':
        return 'fas fa-retweet';
      case 'donation':
        return 'fas fa-gift';
      default:
        return 'fas fa-bell';
    }
  }

  protected getNotificationIconStyle(notificationType: string): string {
    switch (notificationType) {
      case 'like':
        return 'bg-red-500 text-white';
      case 'comment':
        return 'bg-blue-500 text-white';
      case 'follow':
        return 'bg-green-500 text-white';
      case 'repost':
        return 'bg-green-500 text-white';
      case 'donation':
        return 'bg-yellow-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  }

  @HostListener('window:scroll', ['$event'])
  onScroll(event: Event): void {
    // Throttle scroll events to improve performance
    if (this.scrollThrottleTimeout) {
      clearTimeout(this.scrollThrottleTimeout);
    }
    
    this.scrollThrottleTimeout = setTimeout(() => {
      // Check if user scrolled near bottom of page
      const scrollHeight = document.documentElement.scrollHeight;
      const scrollTop = document.documentElement.scrollTop;
      const clientHeight = document.documentElement.clientHeight;
      
      // Trigger load more when user is 200px from bottom
      const threshold = 200;
      
      if (scrollTop + clientHeight >= scrollHeight - threshold && 
          this.hasMore && 
          !this.loading && 
          !this.loadingMore) {

        this.loadMore();
      }
    }, 100); // 100ms throttle
  }
} 