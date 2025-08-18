import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { AuthService } from './auth.service';
import { map, tap } from 'rxjs/operators';

export interface Notification {
  id: number;
  sender?: {
    id: number;
    username: string;
    profile_picture: string | null;
    handle: string;
  };
  notification_type: 'like' | 'comment' | 'follow' | 'repost' | 'donation' | 'report_received' | 'post_removed' | 'appeal_approved' | 'appeal_rejected' | 'art_verified';
  post?: {
    id: number;
    content: string;
    author: {
      id: number;
      username: string;
      handle: string;
      profile_picture: string | null;
    };
    post_type?: string;
    created_at?: string;
    image?: string;
    images?: Array<{
      id: number;
      image: string;
      filename: string;
    }>;
    is_human_drawing?: boolean;
  };
  comment?: {
    id: number;
    content: string;
    amount?: number; // For donation notifications
  };
  is_read: boolean;
  created_at: string;
}

export interface GroupedNotification {
  notification_type: 'like' | 'comment' | 'follow' | 'repost' | 'donation' | 'report_received' | 'post_removed' | 'appeal_approved' | 'appeal_rejected' | 'art_verified';
  post?: {
    id: number;
    content: string;
    author: {
      id: number;
      username: string;
      handle: string;
      profile_picture: string | null;
    };
    post_type?: string;
    created_at?: string;
    image?: string;
    images?: Array<{
      id: number;
      image: string;
      filename: string;
    }>;
    is_human_drawing?: boolean;
  };
  comment?: {
    id: number;
    content: string;
    amount?: number; // For donation notifications
  };
  users: Array<{
    id: number;
    username: string;
    profile_picture: string | null;
    handle: string;
  }>;
  latest_time: string;
  is_read: boolean;
  notification_ids: number[];
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private apiUrl = `${environment.apiUrl}/api/notifications`;
  private socket$?: WebSocketSubject<any>;
  private unreadCount = new BehaviorSubject<number>(0);
  unreadCount$ = this.unreadCount.asObservable();

  // Add subject for specific notification events
  private notificationEvents = new Subject<Notification>();
  notificationEvents$ = this.notificationEvents.asObservable();

  // Global notifications list (similar to chat service)
  private notifications = new BehaviorSubject<GroupedNotification[]>([]);
  notifications$ = this.notifications.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    // Don't call these immediately - wait for user to be authenticated
    this.authService.currentUser$.subscribe((user: any) => {
      if (user) {
        this.connectWebSocket();
        this.loadUnreadCount();
      } else {
        this.disconnectWebSocket();
      }
    });
  }

  loadUnreadCount() {
    this.getUnreadCount().subscribe(count => {
      this.unreadCount.next(count);
    });
  }

  resetUnreadCount() {
    this.unreadCount.next(0);
  }

  decrementUnreadCount() {
    const currentCount = this.unreadCount.value;
    if (currentCount > 0) {
      this.unreadCount.next(currentCount - 1);
    }
  }

  incrementUnreadCount() {
    this.unreadCount.next(this.unreadCount.value + 1);
  }

  private connectWebSocket() {
    if (this.socket$) {
      return;
    }

    const token = this.authService.getToken();
    
    if (!token) {
      return;
    }

    // Use query parameter for token authentication like chat service
    const wsUrl = environment.apiUrl.replace(/^http/, 'ws') + `/ws/notifications/?token=${token}`;
    
    try {
      this.socket$ = webSocket({
        url: wsUrl,
        openObserver: {
          next: () => {
          }
        },
        closeObserver: {
          next: (event) => {
            this.socket$ = undefined;
            // Attempt to reconnect after 5 seconds
            setTimeout(() => {
              this.connectWebSocket();
            }, 5000);
          }
        }
      });
    } catch (error) {
      console.error('❌ Error creating WebSocket:', error);
      return;
    }

    this.socket$.subscribe({
      next: (message) => {

        // Handle incoming notifications
        if (message.type === 'notification') {
          this.unreadCount.next(this.unreadCount.value + 1);
          
          // Emit the notification event for other services to handle
          const notification: Notification = {
            id: message.id,
            sender: message.sender,
            notification_type: message.notification_type,
            post: message.post,
            comment: message.comment,
            is_read: false,
            created_at: message.created_at
          };
          
          this.notificationEvents.next(notification);
          
          // Note: WebSocket notifications are individual, not grouped.
          // The grouping logic is handled by the HTTP GET list endpoint.
          // For real-time updates, we'll need to re-fetch the grouped notifications
          // or implement client-side grouping. For now, we'll just emit the event.
        } else {
          // Unknown message type - ignore
        }
      },
      error: (error: any) => {
        console.error('❌ Notifications WebSocket error:', error);
        this.socket$ = undefined;
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          this.connectWebSocket();
        }, 5000);
      }
    });
  }

  private disconnectWebSocket() {
    if (this.socket$) {
      this.socket$.complete();
      this.socket$ = undefined;
    }
  }

  getNotifications(page: number = 1): Observable<{ results: GroupedNotification[], count: number }> {
    const url = `${this.apiUrl}/?page=${page}&page_size=20`;
    
    return this.http.get<{ results: GroupedNotification[], count: number }>(url).pipe(
      map(response => {
        // Process image URLs for all notifications
        const processedResults = response.results.map(notification => this.addImageUrls(notification));
        return { ...response, results: processedResults };
      }),
      tap(response => {
        if (page === 1) {
          // First page - replace notifications list
          this.notifications.next(response.results);
        } else {
          // Subsequent pages - append to existing list
          const currentNotifications = this.notifications.getValue();
          this.notifications.next([...currentNotifications, ...response.results]);
        }
      })
    );
  }

  getUnreadCount(): Observable<number> {
    const url = `${this.apiUrl}/unread_count/`;
    
    return this.http.get<{ count: number }>(url).pipe(
      map(response => response.count)
    );
  }

  markAsRead(notificationId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${notificationId}/mark_as_read/`, {}).pipe(
      tap(() => {
        // Update the global list
        const currentNotifications = this.notifications.getValue();
        const updatedNotifications = currentNotifications.map(notification => 
          notification.notification_ids.includes(notificationId)
            ? { ...notification, is_read: true }
            : notification
        );
        // Ensure image URLs are processed
        const processedNotifications = updatedNotifications.map(notification => this.addImageUrls(notification));
        this.notifications.next(processedNotifications);
        
        // Update unread count
        this.refreshUnreadCount();
      })
    );
  }

  markGroupAsRead(notificationIds: number[]): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/mark_group_as_read/`, { notification_ids: notificationIds }).pipe(
      tap(() => {
        // Update the global list
        const currentNotifications = this.notifications.getValue();
        const updatedNotifications = currentNotifications.map(notification => 
          notification.notification_ids.some(id => notificationIds.includes(id))
            ? { ...notification, is_read: true }
            : notification
        );
        // Ensure image URLs are processed
        const processedNotifications = updatedNotifications.map(notification => this.addImageUrls(notification));
        this.notifications.next(processedNotifications);
        
        // Update unread count
        this.refreshUnreadCount();
      })
    );
  }

  markAllAsRead(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/mark_all_as_read/`, {}).pipe(
      tap(() => {
        // Update the global list
        const currentNotifications = this.notifications.getValue();
        const updatedNotifications = currentNotifications.map(notification => 
          ({ ...notification, is_read: true })
        );
        // Ensure image URLs are processed
        const processedNotifications = updatedNotifications.map(notification => this.addImageUrls(notification));
        this.notifications.next(processedNotifications);
        
        // Update unread count
        this.refreshUnreadCount();
      })
    );
  }

  private refreshUnreadCount(): void {
    this.getUnreadCount().subscribe({
      next: (count) => {
        this.unreadCount.next(count);
      },
      error: (error) => {
        console.error('Error refreshing unread count:', error);
      }
    });
  }

  getFormattedMessage(notification: GroupedNotification): string {
    const userCount = notification.users.length;
    
    if (userCount === 0) {
      return this.getSystemMessage(notification.notification_type);
    }
    
    // Donations should always be shown individually with amounts
    // Even if somehow grouped, we'll show the first user's donation
    if (notification.notification_type === 'donation') {
      const username = notification.users[0].username;
      return this.getDonationMessage(username, notification);
    }
    
    if (userCount === 1) {
      const username = notification.users[0].username;
      return this.getUserMessage(notification.notification_type, username, notification);
    }
    
    if (userCount === 2) {
      const username1 = notification.users[0].username;
      const username2 = notification.users[1].username;
      return this.getTwoUserMessage(notification.notification_type, username1, username2, notification);
    }
    
    // More than 2 users
    const username1 = notification.users[0].username;
    const username2 = notification.users[1].username;
    const othersCount = userCount - 2;
    return this.getMultipleUserMessage(notification.notification_type, username1, username2, othersCount, notification);
  }

  private getUserMessage(type: string, username: string, notification: GroupedNotification): string {
    switch (type) {
      case 'like':
        return `${username} liked your post`;
      case 'comment':
        return `${username} commented on your post`;
      case 'follow':
        return `${username} followed you`;
      case 'repost':
        return `${username} reposted your post`;
      default:
        return '';
    }
  }

  private getTwoUserMessage(type: string, username1: string, username2: string, notification: GroupedNotification): string {
    switch (type) {
      case 'like':
        return `${username1} and ${username2} liked your post`;
      case 'comment':
        return `${username1} and ${username2} commented on your post`;
      case 'follow':
        return `${username1} and ${username2} followed you`;
      case 'repost':
        return `${username1} and ${username2} reposted your post`;
      default:
        return '';
    }
  }

  private getMultipleUserMessage(type: string, username1: string, username2: string, othersCount: number, notification: GroupedNotification): string {
    switch (type) {
      case 'like':
        return `${username1}, ${username2} and ${othersCount} others liked your post`;
      case 'comment':
        return `${username1}, ${username2} and ${othersCount} others commented on your post`;
      case 'follow':
        return `${username1}, ${username2} and ${othersCount} others followed you`;
      case 'repost':
        return `${username1}, ${username2} and ${othersCount} others reposted your post`;
      default:
        return '';
    }
  }

  private getDonationMessage(username: string, notification: GroupedNotification): string {
    // Get donation amount from comment field (which contains the donation object)
    // Note: Donations should ideally be ungrouped on the backend to show individual amounts
    const donationAmount = notification.comment ? `￥${Math.floor(notification.comment.amount || 0).toLocaleString()}` : '￥0';
    return `${username} donated ${donationAmount} to your post`;
  }

  private getSystemMessage(type: string): string {
    switch (type) {
      case 'report_received':
        return `We received your report`;
      case 'post_removed':
        return `Your post has been removed`;
      case 'appeal_approved':
        return `Your appeal has been approved and your post restored`;
      case 'appeal_rejected':
        return `Your appeal has been rejected`;
      case 'art_verified':
        return `Congrats! Your art has been verified`;
      default:
        return '';
    }
  }

  private addImageUrls(notification: GroupedNotification): GroupedNotification {
    // Create a new notification object to avoid mutations
    const processedNotification = { ...notification };
    
    // Process post images if they exist
    if (processedNotification.post) {
      // Process post author profile picture
      if (processedNotification.post.author?.profile_picture) {
        if (!processedNotification.post.author.profile_picture.startsWith('http') && !processedNotification.post.author.profile_picture.startsWith('data:')) {
          const profilePath = processedNotification.post.author.profile_picture.startsWith('/') ? processedNotification.post.author.profile_picture : `/${processedNotification.post.author.profile_picture}`;
          processedNotification.post.author = {
            ...processedNotification.post.author,
            profile_picture: `${environment.apiUrl}${profilePath}`
          };
        }
      }
      
      // Process post main image
      if (processedNotification.post.image) {
        if (!processedNotification.post.image.startsWith('http') && !processedNotification.post.image.startsWith('data:')) {
          const imagePath = processedNotification.post.image.startsWith('/') ? processedNotification.post.image : `/${processedNotification.post.image}`;
          processedNotification.post.image = `${environment.apiUrl}${imagePath}`;
        }
      }
      
      // Process post images array
      if (processedNotification.post.images) {
        processedNotification.post.images = processedNotification.post.images.map(image => {
          return {
            ...image,
            image: !image.image.startsWith('http') ? `${environment.apiUrl}${image.image.startsWith('/') ? image.image : `/${image.image}`}` : image.image
          };
        });
      }
    }
    
    // Process user profile pictures
    if (processedNotification.users) {
      processedNotification.users = processedNotification.users.map(user => {
        if (user.profile_picture && !user.profile_picture.startsWith('http') && !user.profile_picture.startsWith('data:')) {
          const profilePath = user.profile_picture.startsWith('/') ? user.profile_picture : `/${user.profile_picture}`;
          return {
            ...user,
            profile_picture: `${environment.apiUrl}${profilePath}`
          };
        }
        return user;
      });
    }
    
    return processedNotification;
  }
} 