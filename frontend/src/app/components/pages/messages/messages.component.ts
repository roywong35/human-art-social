import { Component, OnInit, OnDestroy, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../../services/chat.service';
import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';
import { SidebarService } from '../../../services/sidebar.service';
import { Conversation, ConversationDetail, User } from '../../../models';
import { Subscription, take } from 'rxjs';
import { skip } from 'rxjs/operators';
import { TimeAgoPipe } from '../../../pipes/time-ago.pipe';
import { ChatRoomComponent } from '../../features/chat-room/chat-room.component';

declare var Hammer: any;

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TimeAgoPipe, ChatRoomComponent],
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.scss']
})
export class MessagesComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer', { static: false }) messagesContainer!: ElementRef;
  
  conversations: Conversation[] = [];
  selectedConversation: ConversationDetail | null = null;
  currentUser: User | null = null;
  isLoadingConversation = false;
  loadingConversationId: number | null = null;
  isLoadingConversations = false;
  
  // Create chat modal
  showCreateChatModal = false;
  searchQuery = '';
  searchResults: User[] = [];
  isSearching = false;
  
  // Responsive design
  isDesktop = true;
  showChatList = true; // For mobile view switching
  private readonly DESKTOP_BREAKPOINT = 1120;
  private readonly MOBILE_BREAKPOINT = 800;
  
  // Gesture support
  isMobile = false;
  private hammerManager: any;
  
  private routeSub?: Subscription;
  private currentUserSub?: Subscription;
  
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';
  
  constructor(
    private chatService: ChatService,
    private authService: AuthService,
    private userService: UserService,
    private router: Router,
    private route: ActivatedRoute,
    private sidebarService: SidebarService
  ) {}

  ngOnInit() {
    // Check if mobile
    this.isMobile = window.innerWidth < 500;
    
    // Initialize responsive state
    this.checkScreenSize();

    // Get current user
    this.currentUserSub = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });

    // Subscribe to ChatService conversations directly
    // Use skip(1) to ignore the initial empty emission from BehaviorSubject
    this.chatService.conversations$.pipe(skip(1)).subscribe({
      next: (conversations) => {
        this.conversations = conversations;
        
        // Hide loading when we get data (regardless of whether there are conversations or not)
        // This ensures we show "No conversations" when there are truly no conversations
        this.isLoadingConversations = false;
      },
      error: (error) => {
        console.error('❌ Error in ChatService conversations$:', error);
        this.isLoadingConversations = false;
      }
    });

    // Load conversations with caching
    this.loadConversations();

    // Listen for route changes
    this.routeSub = this.route.paramMap.subscribe(params => {
      const conversationId = params.get('conversationId');
      if (conversationId) {
        this.loadConversation(conversationId);
        // On mobile, show chat room when conversation is selected
        if (!this.isDesktop) {
          this.showChatList = false;
        }
      } else {
        // CRITICAL: Clean state when no conversation selected
        this.selectedConversation = null;
        this.isLoadingConversation = false;
        this.loadingConversationId = null;
        this.chatService.disconnectWebSocket();
        this.chatService.clearMessages();
        
        // On mobile, show chat list when no conversation is selected
        if (!this.isDesktop) {
          this.showChatList = true;
        }
      }
    });
    
    // Initialize gesture support after a short delay to ensure DOM is ready
    setTimeout(() => {
      this.initializeGestureSupport();
    }, 100);
  }

  ngOnDestroy() {
    this.routeSub?.unsubscribe();
    this.currentUserSub?.unsubscribe();
    
    // Clean disconnect and state clearing when leaving messages page
    this.chatService.disconnectWebSocket();
    this.chatService.clearMessages();
    
    // Reset loading state
    this.isLoadingConversation = false;
    this.loadingConversationId = null;
    
    // Clean up Hammer.js gesture manager
    if (this.hammerManager) {
      this.hammerManager.destroy();
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.checkScreenSize();
  }

  private checkScreenSize() {
    this.isDesktop = window.innerWidth >= this.DESKTOP_BREAKPOINT;
    
    // Reset mobile view state when switching to desktop
    if (this.isDesktop) {
      this.showChatList = true;
    } else if (window.innerWidth >= this.MOBILE_BREAKPOINT) {
      // Tablet/mobile view with 720px width (>800px <1120px)
      const hasConversation = this.selectedConversation !== null;
      this.showChatList = !hasConversation;
    } else {
      // Small mobile view (<800px) - full width
      const hasConversation = this.selectedConversation !== null;
      this.showChatList = !hasConversation;
    }
  }

  get shouldUseFixedWidth(): boolean {
    return window.innerWidth >= this.MOBILE_BREAKPOINT;
  }

  loadConversations() {
    // Only set loading state if no cached content
    if (!this.chatService.hasCachedConversations()) {
      this.isLoadingConversations = true;
    }
    
    // Use ChatService's state management with caching
    this.chatService.loadConversations();
  }

  forceRefreshConversations() {
    // Force refresh conversations (for pull-to-refresh)
    this.isLoadingConversations = true;
    this.chatService.loadConversations(true);
  }

  loadConversation(conversationId: string) {
    const numericId = parseInt(conversationId, 10);
    

    
    // CRITICAL FIX: Clear previous conversation state immediately to prevent flash
    this.selectedConversation = null;
    this.isLoadingConversation = true;
    
    // Disconnect any existing WebSocket connections first
    this.chatService.disconnectWebSocket();
    
    // Clear messages to prevent old conversation from showing
    this.chatService.clearMessages();
    
    // Try to use cached data first (like floating chat)
    const cachedData = this.chatService.openConversationInstant(numericId);
    
    if (cachedData.conversation && cachedData.messages) {
      // INSTANT OPENING from cache - like X/Twitter!

      
      setTimeout(() => {
        this.selectedConversation = cachedData.conversation;
        this.isLoadingConversation = false;
        this.loadingConversationId = null;
        
        // Connect to WebSocket for real-time updates
        this.chatService.connectToConversation(numericId);
        
        // Mark conversation as read
        this.markConversationAsRead(numericId);
        

      }, 50); // Minimal delay for clean transition
    } else {
      // Fallback to API if not cached

      this.loadConversationFromAPI(numericId);
    }
  }

  private loadConversationFromAPI(numericId: number) {
    this.chatService.getConversation(numericId).subscribe({
      next: (conversation) => {
        // Small delay to ensure clean transition
        setTimeout(() => {
          this.selectedConversation = conversation;
          this.isLoadingConversation = false;
          this.loadingConversationId = null;
          
          // Don't load messages here - let the chat room component handle it
          // this.chatService.loadMessages(numericId); // ❌ REMOVED!
          
          // Connect to WebSocket for this conversation
          this.chatService.connectToConversation(numericId);
          
          // Mark conversation as read when opened
          this.markConversationAsRead(numericId);
        }, 50);
      },
      error: (error) => {
        console.error('Error loading conversation:', error);
        this.isLoadingConversation = false;
        this.loadingConversationId = null;
      }
    });
  }

  selectConversation(conversation: Conversation) {
    // Prevent selecting the same conversation that's already active
    if (this.selectedConversation?.id === conversation.id) {
      return;
    }
    
    // Show immediate loading feedback in the UI
    this.isLoadingConversation = true;
    this.loadingConversationId = conversation.id;
    
    this.router.navigate(['/messages', conversation.id]);
  }

  private markConversationAsRead(conversationId: number) {
    this.chatService.markConversationAsRead(conversationId).subscribe({
      next: () => {
        // The ChatService will automatically update the conversations observable

      },
      error: (error) => {
        console.error('Error marking conversation as read:', error);
      }
    });
  }

  goBackToChatList() {
    this.router.navigate(['/messages']);
  }

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
      next: (response) => {
        // Filter out current user
        this.searchResults = response.results.filter((user: User) => user.id !== this.currentUser?.id);
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
        
        // Small delay to ensure modal is closed before navigation
        setTimeout(() => {
          // Navigate to the new conversation
          this.router.navigate(['/messages', conversation.id]);
          
          // Refresh conversations list using ChatService state management
          this.chatService.loadConversations(true); // Force refresh since new conversation was created
        }, 100);
      }
    } catch (error) {
      console.error('Error creating chat:', error);
      this.isLoadingConversation = false;
      this.loadingConversationId = null;
    }
  }

  getConversationDisplayName(conversation: Conversation): string {
    return conversation.other_participant?.username || 'Unknown User';
  }

  getConversationAvatar(conversation: Conversation): string {
    return conversation.other_participant?.profile_picture || this.defaultAvatar;
  }

  getConversationHandle(conversation: Conversation): string {
    return conversation.other_participant?.handle || '';
  }

  private initializeGestureSupport() {
    if (!this.isMobile || !this.messagesContainer?.nativeElement) {
      return;
    }

    const container = this.messagesContainer.nativeElement;

    // Initialize Hammer.js for swipe gestures
    if (typeof Hammer !== 'undefined') {
      this.hammerManager = new Hammer(container);
      
      // Configure swipe recognition to be more sensitive and cover entire area
      this.hammerManager.get('swipe').set({ 
        direction: Hammer.DIRECTION_HORIZONTAL,
        threshold: 5, // Very low threshold for easier activation
        velocity: 0.2, // Lower velocity requirement
        pointers: 1 // Single finger swipe
      });
      
      // Add additional gesture recognizers to ensure coverage
      this.hammerManager.add(new Hammer.Pan({
        direction: Hammer.DIRECTION_HORIZONTAL,
        threshold: 5,
        pointers: 1
      }));
      
      this.hammerManager.on('swiperight', (e: any) => {
        this.handleSwipeRight();
      });
      
      this.hammerManager.on('panright', (e: any) => {
        // Handle pan right as an alternative to swipe
        if (e.deltaX > 50 && e.velocity > 0.3) {
          this.handleSwipeRight();
        }
      });
    }
  }

  private handleSwipeRight() {
    this.sidebarService.openSidebar();
  }
} 