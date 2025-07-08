import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { AuthService } from './auth.service';
import { map, tap } from 'rxjs/operators';

export interface Notification {
  id: number;
  sender: {
    id: number;
    username: string;
    profile_picture: string | null;
    handle: string;
  };
  notification_type: 'like' | 'comment' | 'follow' | 'repost';
  post?: {
    id: number;
    content: string;
    author: {
      id: number;
      username: string;
      handle: string;
      profile_picture: string | null;
    };
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

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    console.log('🔔 NotificationService constructor called');
    this.connectWebSocket();
    this.authService.currentUser$.subscribe((user: any) => {
      console.log('🔔 NotificationService - user changed:', user ? `User ${user.username}` : 'No user');
      if (user) {
        this.connectWebSocket();
        this.loadUnreadCount();
      } else {
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
          this.socket$ = undefined;
          // Attempt to reconnect after 5 seconds
          setTimeout(() => {
            console.log('🔄 Attempting to reconnect notifications WebSocket...');
            this.connectWebSocket();
          }, 5000);
        }
      }
    });

    this.socket$.subscribe({
      next: (message) => {
        console.log('📨 Notification WebSocket message received:', message);
        // Handle incoming notifications
        if (message.type === 'notification') {
          console.log('🔔 Processing notification, incrementing unread count');
          this.unreadCount.next(this.unreadCount.value + 1);
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
      `${this.apiUrl}/?page=${page}`
    );
  }

  getUnreadCount(): Observable<number> {
    return this.http.get<{ count: number }>(`${this.apiUrl}/unread_count/`).pipe(
      map(response => response.count)
    );
  }

  markAsRead(notificationId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${notificationId}/mark_as_read/`, {});
  }

  markAllAsRead(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/mark_all_as_read/`, {});
  }

  getFormattedMessage(notification: Notification): string {
    const username = notification.sender.username;
    switch (notification.notification_type) {
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
} 