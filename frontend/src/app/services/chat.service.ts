import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';
import { Conversation, ConversationDetail, Message, ChatMessage } from '../models';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = `${environment.apiUrl}/api/chat`;
  private socket$?: WebSocketSubject<any>;
  private currentConversationId?: number;
  private currentUserId?: number;
  
  // State management
  private conversationsSubject = new BehaviorSubject<Conversation[]>([]);
  private messagesSubject = new BehaviorSubject<Message[]>([]);
  private typingUsersSubject = new BehaviorSubject<string[]>([]);
  
  // Public observables
  public conversations$ = this.conversationsSubject.asObservable();
  public messages$ = this.messagesSubject.asObservable();
  public typingUsers$ = this.typingUsersSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    // Track current user ID for unread count logic
    this.authService.currentUser$.subscribe(user => {
      this.currentUserId = user?.id;
    });
  }

  // Conversation API methods
  getConversations(): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(`${this.apiUrl}/conversations/`);
  }

  getConversation(conversationId: number): Observable<ConversationDetail> {
    return this.http.get<ConversationDetail>(`${this.apiUrl}/conversations/${conversationId}/`);
  }

  getOrCreateConversation(userId: number): Observable<ConversationDetail> {
    return this.http.post<ConversationDetail>(`${this.apiUrl}/conversations/get_or_create/`, {
      user_id: userId
    });
  }

  sendMessage(conversationId: number, content: string, image?: File): Observable<Message> {
    const formData = new FormData();
    formData.append('content', content);
    if (image) {
      formData.append('image', image);
    }

    return this.http.post<Message>(`${this.apiUrl}/conversations/${conversationId}/send_message/`, formData);
  }

  getMessages(conversationId: number): Observable<{results: Message[], count: number}> {
    return this.http.get<{results: Message[], count: number}>(`${this.apiUrl}/conversations/${conversationId}/messages/`);
  }

  markConversationAsRead(conversationId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/conversations/${conversationId}/mark_as_read/`, {});
  }

  markMessageAsRead(messageId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/messages/${messageId}/mark_as_read/`, {});
  }

  // WebSocket methods
  connectToConversation(conversationId: number) {
    this.currentConversationId = conversationId;
    this.disconnectWebSocket(); // Close existing connection

    const token = this.authService.getToken();
    console.log('Attempting WebSocket connection with token:', token ? 'Token exists' : 'No token');
    
    if (!token) {
      console.error('No auth token found for WebSocket connection');
      return;
    }

    // Pass token as query parameter instead of protocol
    const wsUrl = environment.apiUrl.replace(/^http/, 'ws') + `/ws/chat/${conversationId}/?token=${token}`;
    console.log('WebSocket URL:', wsUrl);
    
    this.socket$ = webSocket({
      url: wsUrl,
      openObserver: {
        next: () => {
          console.log(`✅ WebSocket connected successfully to conversation ${conversationId}`);
        }
      },
      closeObserver: {
        next: (event) => {
          console.log(`❌ WebSocket disconnected from conversation ${conversationId}`, event);
          // Auto-reconnect after 3 seconds if the connection was not closed intentionally
          if (event.code !== 1000) { // 1000 is normal closure
            console.log(`🔄 Will attempt to reconnect in 3 seconds...`);
            setTimeout(() => {
              if (this.currentConversationId === conversationId) {
                console.log(`🔄 Attempting to reconnect to conversation ${conversationId}`);
                this.connectToConversation(conversationId);
              }
            }, 3000);
          }
        }
      }
    });

    this.socket$.subscribe({
      next: (message: ChatMessage) => {
        console.log('📨 WebSocket message received:', message);
        this.handleWebSocketMessage(message);
      },
      error: (error) => {
        console.error('❌ WebSocket error:', error);
      }
    });
  }

  disconnectWebSocket() {
    if (this.socket$) {
      this.socket$.complete();
      this.socket$ = undefined;
    }
    this.currentConversationId = undefined;
  }

  sendMessageViaWebSocket(content: string) {
    if (this.socket$) {
      this.socket$.next({
        action: 'send_message',
        content: content
      });
    }
  }

  sendTypingIndicator(isTyping: boolean) {
    if (this.socket$) {
      this.socket$.next({
        action: 'typing',
        is_typing: isTyping
      });
    }
  }

  markMessageAsReadViaWebSocket(messageId: number) {
    if (this.socket$) {
      this.socket$.next({
        action: 'mark_as_read',
        message_id: messageId
      });
    }
  }

  // State management methods
  loadConversations() {
    this.getConversations().subscribe({
      next: (conversations) => {
        this.conversationsSubject.next(conversations);
      },
      error: (error) => {
        console.error('Error loading conversations:', error);
      }
    });
  }

  loadMessages(conversationId: number) {
    this.getMessages(conversationId).subscribe({
      next: (response) => {
        this.messagesSubject.next(response.results.reverse()); // Reverse for chat display
      },
      error: (error) => {
        console.error('Error loading messages:', error);
      }
    });
  }

  addMessage(message: Message) {
    const currentMessages = this.messagesSubject.value;
    
    // Check if message already exists (to avoid duplicates from optimistic updates)
    const messageExists = currentMessages.some(msg => 
      msg.id === message.id || 
      (msg.content === message.content && 
       msg.sender.id === message.sender.id && 
       Math.abs(new Date(msg.created_at).getTime() - new Date(message.created_at).getTime()) < 5000) // Within 5 seconds
    );
    
    if (!messageExists) {
      this.messagesSubject.next([...currentMessages, message]);
    }
  }

  updateConversationLastMessage(conversationId: number, message: Message) {
    const conversations = this.conversationsSubject.value;
    const updatedConversations = conversations.map(conv => {
      if (conv.id === conversationId) {
        // Only increment unread count if this is not our own message and we're not currently viewing this conversation
        const shouldIncrementUnread = message.sender.id !== this.getCurrentUserId() && 
                                    this.currentConversationId !== conversationId;
        
        return {
          ...conv,
          last_message: message,
          last_message_at: message.created_at,
          unread_count: shouldIncrementUnread ? (conv.unread_count || 0) + 1 : conv.unread_count
        };
      }
      return conv;
    });
    this.conversationsSubject.next(updatedConversations);
  }

  private getCurrentUserId(): number | null {
    return this.currentUserId || null;
  }

  private handleWebSocketMessage(message: ChatMessage) {
    switch (message.type) {
      case 'chat_message':
        if (message.message) {
          this.addMessage(message.message);
          if (this.currentConversationId) {
            this.updateConversationLastMessage(this.currentConversationId, message.message);
          }
        }
        break;
      
      case 'typing_indicator':
        if (message.username && message.is_typing !== undefined) {
          const currentTyping = this.typingUsersSubject.value;
          let updatedTyping: string[];
          
          if (message.is_typing) {
            // Add user to typing list
            updatedTyping = [...currentTyping.filter(u => u !== message.username), message.username];
          } else {
            // Remove user from typing list
            updatedTyping = currentTyping.filter(u => u !== message.username);
          }
          
          this.typingUsersSubject.next(updatedTyping);
        }
        break;
    }
  }

  // Cleanup
  ngOnDestroy() {
    this.disconnectWebSocket();
  }

  updateMessages(messages: Message[]) {
    this.messagesSubject.next(messages);
  }

  replaceMessage(tempId: number, newMessage: Message) {
    const currentMessages = this.messagesSubject.value;
    const updatedMessages = currentMessages.map(msg => 
      msg.id === tempId ? newMessage : msg
    );
    this.messagesSubject.next(updatedMessages);
  }

  removeMessage(messageId: number) {
    const currentMessages = this.messagesSubject.value;
    const updatedMessages = currentMessages.filter(msg => msg.id !== messageId);
    this.messagesSubject.next(updatedMessages);
  }

  // Test method for debugging WebSocket connection
  testWebSocketConnection(conversationId: number) {
    const token = this.authService.getToken();
    const isAuthenticated = this.authService.isAuthenticated();
    
    console.log('🔍 WebSocket Connection Debug Info:');
    console.log('- Is Authenticated:', isAuthenticated);
    console.log('- Token exists:', !!token);
    console.log('- Token length:', token?.length || 0);
    console.log('- Conversation ID:', conversationId);
    
    if (token) {
      console.log('- Token preview:', token.substring(0, 20) + '...');
    }
    
    return { isAuthenticated, hasToken: !!token };
  }
} 