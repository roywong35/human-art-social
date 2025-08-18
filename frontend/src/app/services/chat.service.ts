import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Conversation, ConversationDetail, Message, ChatMessage } from '../models';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { AuthService } from './auth.service';
import { ChatNotificationService } from './chat-notification.service';

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
  
  // X-style preloading cache
  private conversationCache = new Map<number, ConversationDetail>();
  private messagesCache = new Map<number, Message[]>();
  private preloadingInProgress = new Set<number>();
  
  // Public observables
  public conversations$ = this.conversationsSubject.asObservable();
  public messages$ = this.messagesSubject.asObservable();
  public typingUsers$ = this.typingUsersSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private chatNotificationService: ChatNotificationService
  ) {
    // Track current user ID for unread count logic
    this.authService.currentUser$.subscribe(user => {
      this.currentUserId = user?.id;
    });

    // Subscribe to global chat notifications
    this.chatNotificationService.chatNotifications$.subscribe(notification => {
      this.handleGlobalChatNotification(notification);
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
    return this.http.post(`${this.apiUrl}/conversations/${conversationId}/mark_as_read/`, {}).pipe(
      tap(() => {
        // Update local conversations state to reflect the read status
        this.updateConversationUnreadCount(conversationId, 0);
      })
    );
  }

  markMessageAsRead(messageId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/messages/${messageId}/mark_as_read/`, {});
  }

  // WebSocket methods
  connectToConversation(conversationId: number) {
    // Ensure clean disconnection from any existing connection
    this.disconnectWebSocket();
    
    // Clear any typing indicators from previous conversation
    this.typingUsersSubject.next([]);
    
    // Set the new conversation ID
    this.currentConversationId = conversationId;

    const token = this.authService.getToken();
    
    if (!token) {
      console.error('No auth token found for WebSocket connection');
      return;
    }

    // Pass token as query parameter instead of protocol
    const wsUrl = environment.apiUrl.replace(/^http/, 'ws') + `/ws/chat/${conversationId}/?token=${token}`;
    
    this.socket$ = webSocket({
      url: wsUrl,
      openObserver: {
        next: () => {
          // WebSocket connected successfully
        }
      },
      closeObserver: {
        next: (event) => {
          // Auto-reconnect after 3 seconds if the connection was not closed intentionally
          if (event.code !== 1000) { // 1000 is normal closure
            setTimeout(() => {
              if (this.currentConversationId === conversationId) {
                this.connectToConversation(conversationId);
              }
            }, 3000);
          }
        }
      }
    });

    this.socket$.subscribe({
      next: (message: ChatMessage) => {
        // Pass the conversation ID context to the message handler
        this.handleWebSocketMessage(message, conversationId);
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
    
    // Clear conversation-specific state
    this.currentConversationId = undefined;
    this.typingUsersSubject.next([]);
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
        
        // X-style preloading: Start loading conversation details for all conversations
        this.preloadConversationsData(conversations);
      },
      error: (error) => {
        console.error('❌ Error loading conversations:', error);
      }
    });
  }

  // X-style preloading: Load conversation details and recent messages for instant access
  private preloadConversationsData(conversations: Conversation[]) {
    conversations.forEach((conv, index) => {
      // Stagger preloading to avoid overwhelming the server
      setTimeout(() => {
        this.preloadConversationData(conv.id);
      }, index * 100); // 100ms between each preload
    });
  }

  private preloadConversationData(conversationId: number) {
    if (this.conversationCache.has(conversationId) || this.preloadingInProgress.has(conversationId)) {
      return; // Already cached or being loaded
    }

    this.preloadingInProgress.add(conversationId);

    // Load conversation details
    this.getConversation(conversationId).subscribe({
      next: (conversationDetail) => {
        this.conversationCache.set(conversationId, conversationDetail);
        
        // Load recent messages (limit to last 20 for performance)
        this.getMessages(conversationId).subscribe({
          next: (response) => {
            const messages = response.results.reverse();
            this.messagesCache.set(conversationId, messages);
            this.preloadingInProgress.delete(conversationId);
          },
          error: (error) => {
            console.error('Error preloading messages for conversation', conversationId, error);
            this.preloadingInProgress.delete(conversationId);
          }
        });
      },
      error: (error) => {
        console.error('Error preloading conversation', conversationId, error);
        this.preloadingInProgress.delete(conversationId);
      }
    });
  }

  // Get conversation from cache (X-style instant access)
  getCachedConversation(conversationId: number): ConversationDetail | null {
    return this.conversationCache.get(conversationId) || null;
  }

  // Get messages from cache (X-style instant access)
  getCachedMessages(conversationId: number): Message[] | null {
    return this.messagesCache.get(conversationId) || null;
  }

  // Open conversation with cached data (X-style instant)
  openConversationInstant(conversationId: number): {conversation: ConversationDetail | null, messages: Message[] | null} {
    const conversation = this.getCachedConversation(conversationId);
    const messages = this.getCachedMessages(conversationId);
    
    if (conversation && messages) {
      // Clear previous messages first, then set new ones
      this.messagesSubject.next([]);
      // Small delay to ensure clean transition
      setTimeout(() => {
        this.messagesSubject.next(messages);
      }, 10);
      return {conversation, messages};
    }
    
    return {conversation: null, messages: null};
  }

  loadMessages(conversationId: number) {
    this.getMessages(conversationId).subscribe({
      next: (response) => {
        this.messagesSubject.next(response.results.reverse()); // Reverse for chat display
      },
      error: (error) => {
        console.error('❌ ChatService: Error loading messages:', error);
        // Emit empty array on error so chat room component can show appropriate state
        this.messagesSubject.next([]);
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

  updateConversationUnreadCount(conversationId: number, unreadCount: number) {
    const conversations = this.conversationsSubject.value;
    const updatedConversations = conversations.map(conv => {
      if (conv.id === conversationId) {
        return {
          ...conv,
          unread_count: unreadCount
        };
      }
      return conv;
    });
    this.conversationsSubject.next(updatedConversations);
  }

  private getCurrentUserId(): number | null {
    return this.currentUserId || null;
  }

  private handleGlobalChatNotification(notification: any) {
    
    if (notification.conversation_id && notification.sender) {
      const conversationId = notification.conversation_id;
      
      // Only update unread count if this is not for the conversation we're currently viewing
      // and if the message is not from the current user
      if (conversationId !== this.currentConversationId && 
          notification.sender.id !== this.getCurrentUserId()) {
        
        // Create a message object for preview updates
        const message: Message = {
          id: 0, // Temporary ID for preview
          content: notification.content,
          sender: notification.sender,
          created_at: notification.created_at,
          is_read: false
        };
        
        // Update the conversation's last message and increment unread count
        this.updateConversationLastMessage(conversationId, message);
      }
    }
  }

  private handleWebSocketMessage(message: ChatMessage, conversationId: number) {
    switch (message.type) {
      case 'chat_message':
        if (message.message) {
          // Always update the conversation's last message in the conversations list (for preview text)
          this.updateConversationLastMessage(conversationId, message.message);
          
          // Only add to messages list if this is the conversation we're currently viewing
          if (this.currentConversationId === conversationId) {
            this.addMessage(message.message);
            
            // If this message is not our own message, automatically mark it as read since we're viewing the conversation
            if (message.message.sender.id !== this.getCurrentUserId()) {
              this.markConversationAsRead(conversationId).subscribe({
                error: (error) => {
                  console.error('Error auto-marking conversation as read:', error);
                }
              });
            }
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

  clearMessages() {
    this.messagesSubject.next([]);
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
    
    return { isAuthenticated, hasToken: !!token };
  }
} 