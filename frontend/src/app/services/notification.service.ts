import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { AuthService } from './auth.service';
import { map, tap } from 'rxjs/operators';

console.log('🔔 NotificationService file loaded');

export interface Notification {
  id: number;
  sender?: {
    id: number;
    username: string;
    profile_picture: string | null;
    handle: string;
  };
  notification_type: 'like' | 'comment' | 'follow' | 'repost' | 'report_received' | 'post_removed' | 'appeal_approved' | 'appeal_rejected' | 'art_verified';
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
    console.log('🔔 NotificationService constructor called');
    console.log('🔔 Environment API URL:', environment.apiUrl);
    this.connectWebSocket();
    this.authService.currentUser$.subscribe((user: any) => {
      console.log('🔔 NotificationService - user changed:', user ? `User ${user.username}` : 'No user');
      if (user) {
        console.log('🔔 NotificationService - user authenticated, connecting WebSocket');
        this.connectWebSocket();
        this.loadUnreadCount();
      } else {
        console.log('🔔 NotificationService - no user, disconnecting WebSocket');
        this.disconnectWebSocket();
      }
    });
  }

  loadUnreadCount() {
    console.log('🔔 NotificationService - loading unread count');
    this.getUnreadCount().subscribe(count => {
      console.log('🔔 NotificationService - loaded unread count:', count);
      this.unreadCount.next(count);
    });
  }

  resetUnreadCount() {
    console.log('🔔 NotificationService - resetUnreadCount called');
    this.unreadCount.next(0);
  }

  decrementUnreadCount() {
    const currentCount = this.unreadCount.value;
    console.log('🔔 NotificationService - decrementUnreadCount called, current:', currentCount);
    if (currentCount > 0) {
      this.unreadCount.next(currentCount - 1);
    }
  }

  incrementUnreadCount() {
    console.log('🔔 NotificationService - incrementUnreadCount called, current:', this.unreadCount.value);
    this.unreadCount.next(this.unreadCount.value + 1);
  }

  private connectWebSocket() {
    console.log('🔔 NotificationService - connectWebSocket called');
    
    if (this.socket$) {
      console.log('🔔 NotificationService - WebSocket already exists, skipping connection');
      return;
    }

    const token = this.authService.getToken();
    console.log('🔔 NotificationService - token check:', token ? 'Token exists' : 'No token');
    
    if (!token) {
      console.log('❌ No token available for notifications WebSocket');
      return;
    }

    // Use query parameter for token authentication like chat service
    const wsUrl = environment.apiUrl.replace(/^http/, 'ws') + `/ws/notifications/?token=${token}`;
    console.log('🔔 NotificationService - WebSocket URL:', wsUrl);
    console.log('🔔 NotificationService - Attempting to connect to WebSocket...');
    
    try {
      this.socket$ = webSocket({
        url: wsUrl,
        openObserver: {
          next: () => {
            console.log('✅ Notifications WebSocket connected successfully');
          }
        },
        closeObserver: {
          next: (event) => {
            console.log('❌ Notifications WebSocket disconnected:', event);
            console.log('❌ Close event details:', JSON.stringify(event, null, 2));
            this.socket$ = undefined;
            // Attempt to reconnect after 5 seconds
            setTimeout(() => {
              console.log('🔄 Attempting to reconnect notifications WebSocket...');
              this.connectWebSocket();
            }, 5000);
          }
        }
      });
      console.log('🔔 NotificationService - WebSocket object created successfully');
    } catch (error) {
      console.error('❌ Error creating WebSocket:', error);
      return;
    }

    this.socket$.subscribe({
      next: (message) => {
        console.log('📨 Notification WebSocket message received:', message);
        console.log('📨 Message type:', message.type);
        console.log('📨 Full message object:', JSON.stringify(message, null, 2));
        // Handle incoming notifications
        if (message.type === 'notification') {
          console.log('🔔 Processing notification, incrementing unread count from', this.unreadCount.value, 'to', this.unreadCount.value + 1);
          console.log('🔔 Notification type:', message.notification_type);
          this.unreadCount.next(this.unreadCount.value + 1);
          console.log('🔔 Unread count after increment:', this.unreadCount.value);
          
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
          
          console.log('🔔 Emitting notification event for type:', message.notification_type);
          this.notificationEvents.next(notification);
          
          // Add notification to global list (similar to chat service)
          const currentNotifications = this.notifications.getValue();
          this.notifications.next([notification, ...currentNotifications]);
          console.log('🔔 Added notification to global list, total:', currentNotifications.length + 1);
        } else {
          console.log('🔔 Unknown message type:', message.type);
        }
      },
      error: (error) => {
        console.error('❌ Notifications WebSocket error:', error);
        this.socket$ = undefined;
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          console.log('🔄 Attempting to reconnect after error...');
          this.connectWebSocket();
        }, 5000);
      }
    });
  }

  private disconnectWebSocket() {
    console.log('🔔 NotificationService - disconnectWebSocket called');
    if (this.socket$) {
      console.log('🔔 NotificationService - closing existing WebSocket connection');
      this.socket$.complete();
      this.socket$ = undefined;
    } else {
      console.log('🔔 NotificationService - no WebSocket to disconnect');
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
          console.log('🔔 Updated global notifications list with', response.results.length, 'notifications');
        } else {
          // Subsequent pages - append to existing list
          const currentNotifications = this.notifications.getValue();
          this.notifications.next([...currentNotifications, ...response.results]);
          console.log('🔔 Appended', response.results.length, 'notifications to global list');
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
        console.log('🔔 Marked notification', notificationId, 'as read in global list');
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
        console.log('🔔 Marked all notifications as read in global list');
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