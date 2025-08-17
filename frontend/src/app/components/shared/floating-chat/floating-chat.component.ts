import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChatService } from '../../../services/chat.service';
import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';
import { Conversation, ConversationDetail, User } from '../../../models';
import { Subscription } from 'rxjs';
import { TimeAgoPipe } from '../../../pipes/time-ago.pipe';
import { ChatRoomComponent } from '../../features/chat-room/chat-room.component';

@Component({
  selector: 'app-floating-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, TimeAgoPipe, ChatRoomComponent],
  templateUrl: './floating-chat.component.html',
  styleUrls: ['./floating-chat.component.scss']
})
export class FloatingChatComponent implements OnInit, OnDestroy {
  // Main state
  isOpen = false;
  currentView: 'list' | 'chat' = 'list';
  conversations: Conversation[] = [];
  selectedConversation: ConversationDetail | null = null;
  currentUser: User | null = null;
  isLoadingConversation = false;
  
  // Dark mode detection
  isDarkMode = false;
  

  
  // Create chat modal
  showCreateChatModal = false;
  searchQuery = '';
  searchResults: User[] = [];
  isSearching = false;
  
  // Subscriptions
  private currentUserSub?: Subscription;
  private conversationsSub?: Subscription;
  
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';
  
  constructor(
    private chatService: ChatService,
    private authService: AuthService,
    private userService: UserService,
    private router: Router
  ) {}

  ngOnInit() {
    // Initialize dark mode detection
    this.checkDarkMode();
    this.observeDarkModeChanges();
    
    // Get current user
    this.currentUserSub = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;

      
      // Debug authentication state
      this.debugAuthState();
      
      // Only load conversations if user is authenticated
      if (user && this.authService.isAuthenticated()) {

        this.chatService.loadConversations();
      } else {

        // Clear conversations if user logs out
        this.conversations = [];
        this.selectedConversation = null;
        this.currentView = 'list';
      }
    });

        // Subscribe to conversations
    this.conversationsSub = this.chatService.conversations$.subscribe(conversations => {
      this.conversations = conversations;
    });



    // Only load conversations initially if user is authenticated
    if (this.currentUser && this.authService.isAuthenticated()) {
      this.chatService.loadConversations();
    }
  }

  private debugAuthState() {
    const accessToken = localStorage.getItem('access_token');
    const refreshToken = localStorage.getItem('refresh_token');
    const storedUser = localStorage.getItem('user');
    

  }

  ngOnDestroy() {
    this.currentUserSub?.unsubscribe();
    this.conversationsSub?.unsubscribe();
    
    // Disconnect WebSocket if we have an active chat
    if (this.selectedConversation) {
      this.chatService.disconnectWebSocket();
    }
    
    // Reset loading state
    this.isLoadingConversation = false;
  }

  // Toggle overlay
  toggleChat() {
    this.isOpen = !this.isOpen;
    if (!this.isOpen) {
      this.closeChatRoom();
    }
  }

  closeChat() {
    this.isOpen = false;
    this.isLoadingConversation = false;
    this.closeChatRoom();
  }

  // Chat list actions - X-style instant opening
  selectConversation(conversation: Conversation) {
    // Check if user is authenticated before trying to access conversation
    if (!this.authService.isAuthenticated() || !this.currentUser) {
      console.warn('User not authenticated, cannot access conversation');
      return;
    }


    
    // CRITICAL FIX: Clear previous conversation state immediately to prevent flash
    this.selectedConversation = null;
    this.isLoadingConversation = true;
    
    // Disconnect any existing WebSocket connections first
    this.chatService.disconnectWebSocket();
    
    // Clear messages to prevent old conversation from showing
    this.chatService.clearMessages();
    
    // Try to open conversation instantly with cached data
    const cachedData = this.chatService.openConversationInstant(conversation.id);
    
    if (cachedData.conversation && cachedData.messages) {
      // INSTANT OPENING - like X/Twitter!
      // Small delay to ensure clean state transition
      setTimeout(() => {
        this.selectedConversation = cachedData.conversation;
        this.currentView = 'chat';
        this.isLoadingConversation = false;
        
        // Connect to WebSocket for real-time updates
        this.chatService.connectToConversation(conversation.id);
        
        // Mark conversation as read
        this.markConversationAsRead(conversation.id);
        

      }, 50); // Minimal delay for clean transition
    } else {
      // Fallback to API if not cached (shouldn't happen often)

      this.loadConversationFromAPI(conversation);
    }
  }

  // Fallback method for cache misses
  private loadConversationFromAPI(conversation: Conversation) {
    // Ensure clean state before API call
    this.selectedConversation = null;
    this.isLoadingConversation = true;
    this.chatService.clearMessages();
    
    this.chatService.getConversation(conversation.id).subscribe({
      next: (conversationDetail) => {
        // Small delay to ensure clean transition
        setTimeout(() => {
          this.selectedConversation = conversationDetail;
          this.currentView = 'chat';
          this.isLoadingConversation = false;
          
          // Don't load messages here - let the chat room component handle it
          // this.chatService.loadMessages(conversation.id); // ❌ REMOVED!
          
          // Connect to WebSocket
          this.chatService.connectToConversation(conversation.id);
          
          // Mark as read
          this.markConversationAsRead(conversation.id);
        }, 50);
      },
      error: (error) => {
        console.error('Error loading conversation:', error);
        this.isLoadingConversation = false;
        if (error.status === 401) {
          this.refreshAuthAndRetry(conversation);
        }
      }
    });
  }

  private refreshAuthAndRetry(conversation: Conversation) {

    
    // Check if we have tokens in localStorage
    const hasTokens = localStorage.getItem('access_token') && localStorage.getItem('refresh_token');
    
    if (!hasTokens) {
      console.error('No tokens found, user needs to log in again');
      this.isLoadingConversation = false;
      return;
    }

    // Try to load user from auth service
    this.authService.loadUser().subscribe({
      next: () => {

        // Retry with API fallback
        this.loadConversationFromAPI(conversation);
      },
      error: (authError) => {
        console.error('Auth refresh failed:', authError);
        this.isLoadingConversation = false;
      }
    });
  }

  closeChatRoom() {
    if (this.selectedConversation) {
      // Clean disconnection and state clearing
      this.chatService.disconnectWebSocket();
      this.chatService.clearMessages();
      this.selectedConversation = null;
      

    }
    this.isLoadingConversation = false;
    this.currentView = 'list';
  }

  private markConversationAsRead(conversationId: number) {
    this.chatService.markConversationAsRead(conversationId).subscribe({
      next: () => {

      },
      error: (error) => {
        console.error('Error marking conversation as read:', error);
      }
    });
  }

  // Create chat modal (reused from messages component)
  openCreateChatModal() {
    this.showCreateChatModal = true;
    this.searchQuery = '';
    this.searchResults = [];
  }

  closeCreateChatModal() {
    this.showCreateChatModal = false;
    this.searchQuery = '';
    this.searchResults = [];
  }

  searchUsers() {
    if (this.searchQuery.trim().length < 2) {
      this.searchResults = [];
      return;
    }

    this.isSearching = true;
    this.userService.searchUsers(this.searchQuery).subscribe({
      next: (users) => {
        // Filter out current user
        this.searchResults = users.filter(user => user.id !== this.currentUser?.id);
        this.isSearching = false;
      },
      error: (error) => {
        console.error('Error searching users:', error);
        this.isSearching = false;
      }
    });
  }

  async createChat(user: User) {
    try {
      // Clear state before creating new conversation
      this.selectedConversation = null;
      this.isLoadingConversation = true;
      this.chatService.disconnectWebSocket();
      this.chatService.clearMessages();
      
      const conversation = await this.chatService.getOrCreateConversation(user.id).toPromise();
      if (conversation) {
        // Close modal first
        this.closeCreateChatModal();
        
        // Set as selected conversation with clean transition
        setTimeout(() => {
          this.selectedConversation = conversation;
          this.currentView = 'chat';
          this.isLoadingConversation = false;
          
          // Don't load messages here - let the chat room component handle it
          // this.chatService.loadMessages(conversation.id); // ❌ REMOVED!
          
          // Connect to WebSocket
          this.chatService.connectToConversation(conversation.id);
          
          // Refresh conversations list
          this.chatService.loadConversations();
        }, 100);
      }
    } catch (error) {
      console.error('Error creating chat:', error);
      this.isLoadingConversation = false;
    }
  }

  // Helper methods
  getConversationDisplayName(conversation: Conversation): string {
    return conversation.other_participant?.username || 'Unknown User';
  }

  getConversationAvatar(conversation: Conversation): string {
    return conversation.other_participant?.profile_picture || this.defaultAvatar;
  }

  getConversationHandle(conversation: Conversation): string {
    return conversation.other_participant?.handle || '';
  }

  getUnreadCount(): number {
    return this.conversations.reduce((total, conv) => total + (conv.unread_count || 0), 0);
  }

  // Close on outside click
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const chatOverlay = document.querySelector('.floating-chat-overlay');
    const chatButton = document.querySelector('.floating-chat-button');
    
    if (this.isOpen && chatOverlay && chatButton) {
      if (!chatOverlay.contains(target) && !chatButton.contains(target)) {
        this.closeChat();
      }
    }
  }

  // Navigate to full messages page
  openFullMessagesPage() {
    this.closeChat();
    this.router.navigate(['/messages']);
  }

  // Dark mode detection methods
  private checkDarkMode(): void {
    this.isDarkMode = document.documentElement.classList.contains('dark');

  }

  private observeDarkModeChanges(): void {
    // Watch for dark mode changes
    const observer = new MutationObserver(() => {
      const newDarkMode = document.documentElement.classList.contains('dark');
      if (newDarkMode !== this.isDarkMode) {
        this.isDarkMode = newDarkMode;

      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
  }
} 