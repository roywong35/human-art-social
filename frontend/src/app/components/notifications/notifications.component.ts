import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, Notification } from '../../services/notification.service';
import { Router, RouterModule } from '@angular/router';
import { TimeAgoPipe } from '../../pipes/time-ago.pipe';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, TimeAgoPipe, RouterModule],
  template: `
    <div class="max-w-2xl mx-auto">
      <div class="sticky top-0 z-10 bg-white dark:bg-[color:var(--color-background)] border-b dark:border-[color:var(--color-border)] p-4">
        <h1 class="text-xl font-bold dark:text-[color:var(--color-text)]">Notifications</h1>
        <button *ngIf="notifications.length > 0" 
                (click)="markAllAsRead()"
                class="text-sm text-primary hover:underline mt-2">
          Mark all as read
        </button>
      </div>

      <div class="divide-y dark:divide-[color:var(--color-border)]">
        <div *ngFor="let notification of notifications"
             [class.bg-gray-50]="!notification.is_read"
             class="p-4 hover:bg-gray-50 dark:hover:bg-[color:var(--color-surface-hover)] transition-colors cursor-pointer"
             (click)="onNotificationClick(notification)">
          <div class="flex items-center">
            <!-- Avatar - Always links to sender's profile -->
            <a [routerLink]="['/', notification.sender.handle]" 
               class="flex-shrink-0"
               (click)="$event.stopPropagation(); markAsRead(notification)">
              <img [src]="notification.sender.profile_picture || defaultAvatar"
                   [alt]="notification.sender.username"
                   class="w-10 h-10 rounded-full object-cover hover:opacity-80 transition-opacity">
            </a>
            
            <!-- Notification Content -->
            <div class="flex-1 mx-3">
              <p class="dark:text-[color:var(--color-text)] leading-none">
                <!-- Username - Always links to sender's profile -->
                <a [routerLink]="['/', notification.sender.handle]"
                   class="font-bold hover:underline"
                   (click)="$event.stopPropagation(); markAsRead(notification)">
                  {{ notification.sender.username }}
                </a>
                <!-- Rest of the notification message -->
                <span class="ml-1">{{ getFormattedMessageWithoutUsername(notification) }}</span>
              </p>
            </div>
            
            <div class="text-sm text-gray-500 dark:text-[color:var(--color-text-secondary)] whitespace-nowrap flex-shrink-0">
              {{ notification.created_at | timeAgo }}
            </div>
          </div>
        </div>
      </div>

      <div *ngIf="notifications.length === 0" class="p-4 text-center text-gray-500 dark:text-[color:var(--color-text-secondary)]">
        No notifications yet
      </div>

      <div *ngIf="loading" class="p-4 text-center">
        <span class="text-gray-500 dark:text-[color:var(--color-text-secondary)]">Loading...</span>
      </div>

      <div *ngIf="hasMore && !loading" class="p-4 text-center">
        <button (click)="loadMore()" 
                class="text-primary hover:underline">
          Load more
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
    }
  `]
})
export class NotificationsComponent implements OnInit {
  notifications: Notification[] = [];
  loading = true;
  currentPage = 1;
  hasMore = false;
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  constructor(
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadNotifications();
  }

  loadNotifications() {
    this.loading = true;
    this.notificationService.getNotifications(this.currentPage).subscribe({
      next: (response) => {
        if (this.currentPage === 1) {
          this.notifications = response.results;
        } else {
          this.notifications = [...this.notifications, ...response.results];
        }
        this.hasMore = response.results.length === 10; // Assuming page size is 10
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  loadMore() {
    this.currentPage++;
    this.loadNotifications();
  }

  markAllAsRead() {
    // Update UI immediately
    this.notifications = this.notifications.map(notification => ({
      ...notification,
      is_read: true
    }));
    this.notificationService.resetUnreadCount();

    // Then make the backend call
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
      notification.is_read = true;
      this.notificationService.decrementUnreadCount();

      this.notificationService.markAsRead(notification.id).subscribe({
        error: () => {
          notification.is_read = false;
          this.notificationService.incrementUnreadCount();
        }
      });
    }
  }

  getFormattedMessage(notification: Notification): string {
    return this.notificationService.getFormattedMessage(notification);
  }

  getFormattedMessageWithoutUsername(notification: Notification): string {
    const fullMessage = this.notificationService.getFormattedMessage(notification);
    return fullMessage.replace(notification.sender.username, '').trim();
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
        console.log('Navigating to profile:', ['/', notification.sender.handle]);
        this.router.navigate(['/', notification.sender.handle]);
        break;
    }
  }
} 