import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, Notification } from '../../../services/notification.service';
import { Router, RouterModule } from '@angular/router';
import { TimeAgoPipe } from '../../../pipes/time-ago.pipe';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ReportStatusDialogComponent } from './report-status-dialog/report-status-dialog.component';
import { PostRemovalDialogComponent } from '../../dialogs/post-removal-dialog/post-removal-dialog.component';
import { Post } from '../../../models/post.model';
import { GlobalModalService } from '../../../services/global-modal.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, TimeAgoPipe, RouterModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss']
})
export class NotificationsComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
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
    console.log('🔔 NotificationsComponent constructor called');
    
    // Subscribe to global notifications list (similar to chat service)
    const notificationsSub = this.notificationService.notifications$.subscribe({
      next: (notifications) => {
        console.log('🔔 NotificationsComponent: Global notifications updated:', notifications.length);
        this.notifications = notifications;
      },
      error: (error) => {
        console.error('🔔 NotificationsComponent: Error in global notifications subscription:', error);
      }
    });
    this.subscriptions.push(notificationsSub);
    console.log('🔔 NotificationsComponent: Subscribed to global notifications$');
  }

  ngOnInit() {
    this.loadNotifications();
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
    console.log('🔔 Loading notifications, page:', this.currentPage);
    this.loading = true;
    this.notificationService.getNotifications(this.currentPage).subscribe({
      next: (response) => {
        console.log('🔔 Notifications loaded:', response);
        console.log('🔔 Number of notifications:', response.results.length);
        console.log('🔔 Notification types:', response.results.map(n => n.notification_type));
        
        // The global list is updated automatically by the service
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
    
    console.log('🔔 Loading more notifications, page:', this.currentPage + 1);
    this.loadingMore = true;
    this.currentPage++;
    
    this.notificationService.getNotifications(this.currentPage).subscribe({
      next: (response) => {
        console.log('🔔 More notifications loaded:', response);
        console.log('🔔 Number of new notifications:', response.results.length);
        
        // The global list is updated automatically by the service
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

  markAsRead(notification: Notification) {
    if (!notification.is_read) {
      // Decrement unread count immediately
      this.notificationService.decrementUnreadCount();

      // Make the backend call (service will update global list)
      this.notificationService.markAsRead(notification.id).subscribe({
        error: () => {
          // Revert unread count if the backend call fails
          this.notificationService.incrementUnreadCount();
        }
      });
    }
  }

  getFormattedMessageWithoutUsername(notification: Notification): string {
    const fullMessage = this.notificationService.getFormattedMessage(notification);
    if (notification.sender?.username) {
      return fullMessage.replace(notification.sender.username, '').trim();
    }
    return fullMessage;
  }

  onNotificationClick(notification: Notification) {
    console.log('Notification clicked:', notification);
    this.markAsRead(notification);

    // Navigate based on notification type
    switch (notification.notification_type) {
      case 'like':
      case 'comment':
      case 'repost':
        console.log('Post data:', notification.post);
        if (notification.post?.id && notification.post?.author?.handle) {
          console.log('Navigating to:', ['/', notification.post.author.handle, 'post', notification.post.id]);
          this.router.navigate(['/', notification.post.author.handle, 'post', notification.post.id]);
        } else {
          console.log('Missing post data for navigation');
        }
        break;
      case 'follow':
        if (notification.sender) {
          console.log('Navigating to profile:', ['/', notification.sender.handle]);
          this.router.navigate(['/', notification.sender.handle]);
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
          console.log('Navigating to restored post:', ['/', notification.post.author.handle, 'post', notification.post.id]);
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
          console.log('Navigating to verified art post:', ['/', notification.post.author.handle, 'post', notification.post.id]);
          this.router.navigate(['/', notification.post.author.handle, 'post', notification.post.id]);
        }
        break;
    }
  }

  private showReportDialog() {
    console.log('🔔 Opening report status dialog');
    
    // Use the exact same approach as create post modal
    const dialogRef = this.dialog.open(ReportStatusDialogComponent, {
      panelClass: ['report-status-dialog']
    });
    
    console.log('🔔 Dialog reference:', dialogRef);
    
    dialogRef.afterClosed().subscribe(result => {
      console.log('🔔 Dialog closed with result:', result);
    });
  }

  private showPostRemovalDialog(notification: Notification) {
    console.log('🔔 Opening post removal dialog for notification:', notification);
    
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
    
    console.log('🔔 Post removal dialog reference:', dialogRef);
    
    dialogRef.afterClosed().subscribe(result => {
      console.log('🔔 Post removal dialog closed with result:', result);
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
      
      console.log('🎯 Notifications: Preparing accurate modal for user', user.username);
      
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

  protected onModalHover(): void {
    // When hovering over the modal, cancel any pending close
    if (this.leaveTimeout) {
      clearTimeout(this.leaveTimeout);
    }
    this.globalModalService.onModalHover();
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
        console.log('🔔 Loading more notifications due to scroll');
        this.loadMore();
      }
    }, 100); // 100ms throttle
  }
} 