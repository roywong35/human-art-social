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
  private notifications = new BehaviorSubject<Notification[]>([]);
  notifications$ = this.notifications.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.connectWebSocket();
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
            console.log('✅ Notifications WebSocket connected');
          }
        },
        closeObserver: {
          next: (event) => {
            console.log('❌ Notifications WebSocket disconnected');
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
          
          // Add notification to global list (similar to chat service)
          const currentNotifications = this.notifications.getValue();
          this.notifications.next([notification, ...currentNotifications]);
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

  getNotifications(page: number = 1): Observable<{ results: Notification[], count: number }> {
    return this.http.get<{ results: Notification[], count: number }>(
      `${this.apiUrl}/?page=${page}&page_size=20`
    ).pipe(
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
    return this.http.get<{ count: number }>(`${this.apiUrl}/unread_count/`).pipe(
      map(response => response.count)
    );
  }

  markAsRead(notificationId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${notificationId}/mark_as_read/`, {}).pipe(
      tap(() => {
        // Update the global list
        const currentNotifications = this.notifications.getValue();
        const updatedNotifications = currentNotifications.map(notification => 
          notification.id === notificationId 
            ? { ...notification, is_read: true }
            : notification
        );
        this.notifications.next(updatedNotifications);
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
        this.notifications.next(updatedNotifications);
      })
    );
  }

  getFormattedMessage(notification: Notification): string {
    const username = notification.sender?.username;
    switch (notification.notification_type) {
      case 'like':
        return `${username} liked your post`;
      case 'comment':
        return `${username} commented on your post`;
      case 'follow':
        return `${username} followed you`;
      case 'repost':
        return `${username} reposted your post`;
      case 'donation':
        // Get donation amount from comment field (which contains the donation object)
        const donationAmount = notification.comment ? `￥${Math.floor(notification.comment.amount || 0).toLocaleString()}` : '￥0';
        return `${username} donated ${donationAmount} to your post`;
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
} 