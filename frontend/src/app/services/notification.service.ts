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

    const wsUrl = environment.apiUrl.replace(/^http/, 'ws') + '/ws/notifications/';
    this.socket$ = webSocket({
      url: wsUrl,
      protocol: ['Bearer', token],
      openObserver: {
        next: () => {
          console.log('WebSocket connected');
        }
      },
      closeObserver: {
        next: () => {
          console.log('WebSocket disconnected');
          // Attempt to reconnect after 5 seconds
          setTimeout(() => this.connectWebSocket(), 5000);
        }
      }
    });

    this.socket$.subscribe({
      next: (message) => {
        // Handle incoming notifications
        if (message.type === 'notification') {
          this.unreadCount.next(this.unreadCount.value + 1);
        }
      },
      error: (error) => {
        console.error('WebSocket error:', error);
        this.socket$ = undefined;
        // Attempt to reconnect after 5 seconds
        setTimeout(() => this.connectWebSocket(), 5000);
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