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
      console.log('FloatingChat - Current user changed:', user ? `User ${user.username}` : 'No user');
      
      // Debug authentication state
      this.debugAuthState();
      
      // Only load conversations if user is authenticated
      if (user && this.authService.isAuthenticated()) {
        console.log('FloatingChat - Loading conversations for authenticated user');
        this.chatService.loadConversations();
      } else {
        console.log('FloatingChat - User not authenticated, clearing conversations');
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
    
    console.log('🔍 Auth Debug State:', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      hasStoredUser: !!storedUser,
      isAuthenticated: this.authService.isAuthenticated(),
      currentUser: this.currentUser?.username || 'None',
      tokenFromService: !!this.authService.getToken(),
      accessTokenLength: accessToken?.length || 0,
      accessTokenPreview: accessToken ? accessToken.substring(0, 20) + '...' : 'None'
    });
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

    console.log('⚡ X-style: Opening conversation', conversation.id, 'instantly');
    
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
        
        console.log('🚀 Conversation opened instantly from cache!');
      }, 50); // Minimal delay for clean transition
    } else {
      // Fallback to API if not cached (shouldn't happen often)
      console.log('⏳ Cache miss, falling back to API');
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
          
          // Load messages
          this.chatService.loadMessages(conversation.id);
          
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
    console.log('Attempting to refresh authentication...');
    
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
        console.log('Auth refresh successful, retrying conversation load');
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
      
      console.log('🔙 Chat room closed, state cleared');
    }
    this.isLoadingConversation = false;
    this.currentView = 'list';
  }

  private markConversationAsRead(conversationId: number) {
    this.chatService.markConversationAsRead(conversationId).subscribe({
      next: () => {
        console.log('Conversation marked as read:', conversationId);
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
        this.closeCreateChatModal();
        
        // Set as selected conversation with clean transition
        setTimeout(() => {
          this.selectedConversation = conversation;
          this.currentView = 'chat';
          this.isLoadingConversation = false;
          
          // Load messages for new conversation
          this.chatService.loadMessages(conversation.id);
          
          // Connect to WebSocket
          this.chatService.connectToConversation(conversation.id);
          
          // Refresh conversations list
          this.chatService.loadConversations();
        }, 50);
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
    return conversation.other_participant?.profile_picture || 'assets/placeholder-image.svg';
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
    console.log('FloatingChat - Dark mode detected:', this.isDarkMode);
  }

  private observeDarkModeChanges(): void {
    // Watch for dark mode changes
    const observer = new MutationObserver(() => {
      const newDarkMode = document.documentElement.classList.contains('dark');
      if (newDarkMode !== this.isDarkMode) {
        this.isDarkMode = newDarkMode;
        console.log('FloatingChat - Dark mode changed to:', this.isDarkMode);
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
  }
} 