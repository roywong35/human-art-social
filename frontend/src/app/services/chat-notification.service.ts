import { Injectable } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export interface ChatNotification {
  conversation_id: number;
  sender: {
    id: number;
    username: string;
    handle: string;
    profile_picture: string | null;
  };
  content: string;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatNotificationService {
  private socket$?: WebSocketSubject<any>;
  private chatNotifications = new Subject<ChatNotification>();
  
  public chatNotifications$ = this.chatNotifications.asObservable();

  constructor(private authService: AuthService) {
    // Auto-connect when user logs in
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.connect();
      } else {
        this.disconnect();
      }
    });
  }

  private connect() {
    if (this.socket$) {
      return; // Already connected
    }

    const token = this.authService.getToken();
    if (!token) {
      return;
    }

    // Connect to a global chat notifications endpoint
    const wsUrl = environment.apiUrl.replace(/^http/, 'ws') + `/ws/chat_notifications/?token=${token}`;
    
    this.socket$ = webSocket({
      url: wsUrl,
      openObserver: {
        next: () => {
          console.log('✅ Chat notifications WebSocket connected');
        }
      },
      closeObserver: {
        next: () => {
          console.log('Chat notifications WebSocket disconnected');
          this.socket$ = undefined;
          // Attempt to reconnect after 5 seconds
          setTimeout(() => this.connect(), 5000);
        }
      }
    });

    this.socket$.subscribe({
      next: (notification: ChatNotification) => {
        this.chatNotifications.next(notification);
      },
      error: (error) => {
        console.error('❌ Chat notifications WebSocket error:', error);
        this.socket$ = undefined;
        // Attempt to reconnect after 5 seconds
        setTimeout(() => this.connect(), 5000);
      }
    });
  }

  private disconnect() {
    if (this.socket$) {
      this.socket$.complete();
      this.socket$ = undefined;
    }
  }
} 