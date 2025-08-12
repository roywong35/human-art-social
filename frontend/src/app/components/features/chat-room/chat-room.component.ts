import { Component, Input, OnInit, OnDestroy, OnChanges, ViewChild, ElementRef, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../../services/chat.service';
import { AuthService } from '../../../services/auth.service';
import { ImageUploadService } from '../../../services/image-upload.service';
import { EmojiPickerService } from '../../../services/emoji-picker.service';
import { ConversationDetail, Message, User } from '../../../models';
import { Subscription } from 'rxjs';
import { TimeAgoPipe } from '../../../pipes/time-ago.pipe';

@Component({
  selector: 'app-chat-room',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-room.component.html',
  styleUrls: ['./chat-room.component.scss'],
  host: {
    '[class.floating-chat-mode]': 'isFloatingChat'
  }
})
export class ChatRoomComponent implements OnInit, OnDestroy, OnChanges, AfterViewChecked {
  @Input() conversation!: ConversationDetail;
  @Input() currentUser!: User | null;
  @Input() isMobileView: boolean = false;
  @Input() isFloatingChat: boolean = false;
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;
  @ViewChild('fileInput') fileInput!: ElementRef;

  messages: Message[] = [];
  messageContent = '';
  isTyping = false;
  typingUsers: string[] = [];
  isSending = false;
  selectedImages: File[] = [];
  imagePreviews: string[] = [];
  
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  
  private messagesSub?: Subscription;
  private typingSub?: Subscription;
  private typingTimeout?: any;
  private shouldScrollToBottom = true;
  
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  constructor(
    private chatService: ChatService,
    private authService: AuthService,
    private imageUploadService: ImageUploadService,
    private emojiPickerService: EmojiPickerService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Subscribe to messages
    this.messagesSub = this.chatService.messages$.subscribe(messages => {
      this.messages = messages;
      this.shouldScrollToBottom = true;
      this.cd.detectChanges();
    });

    // Subscribe to typing indicators
    this.typingSub = this.chatService.typingUsers$.subscribe(users => {
      this.typingUsers = users;
      this.cd.detectChanges();
    });

    // Load messages for the current conversation
    if (this.conversation) {
      this.chatService.loadMessages(this.conversation.id);
    }
  }

  ngOnChanges(changes: any) {
    // Handle conversation changes
    if (changes.conversation) {
      if (this.conversation) {
        console.log('🔄 Chat room conversation changed:', this.conversation.id);
        
        // Debug WebSocket connection
        this.chatService.testWebSocketConnection(this.conversation.id);
        
        this.chatService.loadMessages(this.conversation.id);
      } else {
        // Clear ALL chat state when conversation becomes null (back button clicked)
        console.log('🧹 Chat room clearing all state - conversation is null');
        this.messages = [];
        this.messageContent = '';
        this.typingUsers = [];
        this.isTyping = false;
        this.clearSelectedImages();
        this.cd.detectChanges();
      }
    }
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy() {
    this.messagesSub?.unsubscribe();
    this.typingSub?.unsubscribe();
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    // Clean up image previews
    this.imagePreviews.forEach(preview => {
      if (preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }
    });
  }

  scrollToBottom(): void {
    if (this.messagesContainer) {
      const element = this.messagesContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }

  onMessageInput() {
    // Send typing indicator
    if (!this.isTyping) {
      this.isTyping = true;
      this.chatService.sendTypingIndicator(true);
    }

    // Clear existing timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    // Set timeout to stop typing indicator
    this.typingTimeout = setTimeout(() => {
      this.isTyping = false;
      this.chatService.sendTypingIndicator(false);
    }, 1000);
  }

  async sendMessage() {
    if ((!this.messageContent.trim() && this.selectedImages.length === 0) || this.isSending) {
      return;
    }

    this.isSending = true;
    const content = this.messageContent.trim();
    const image = this.selectedImages[0]; // For now, support single image

    // Create optimistic message for instant display
    const optimisticMessage: Message = {
      id: Date.now(), // Temporary ID
      content: content,
      image_url: this.imagePreviews[0] || undefined,
      sender: this.currentUser!,
      created_at: new Date().toISOString(),
      is_read: false
    };

    // Add message immediately to local state via service
    this.chatService.addMessage(optimisticMessage);
    this.shouldScrollToBottom = true;

    // Clear input immediately
    const originalContent = this.messageContent;
    const originalImages = [...this.selectedImages];
    const originalPreviews = [...this.imagePreviews];
    
    this.messageContent = '';
    this.clearSelectedImages();
    
    // Reset textarea height after DOM updates
    setTimeout(() => {
      if (this.messageInput) {
        this.autoResize(this.messageInput.nativeElement);
      }
    }, 0);

    try {
      // Send message via HTTP API
      const sentMessage = await this.chatService.sendMessage(this.conversation.id, content, image).toPromise();
      
      if (sentMessage) {
        // Replace optimistic message with the real one
        this.chatService.replaceMessage(optimisticMessage.id, sentMessage);
      }
      
      // Stop typing indicator
      if (this.isTyping) {
        this.isTyping = false;
        this.chatService.sendTypingIndicator(false);
      }

      // Scroll to bottom
      this.shouldScrollToBottom = true;
      
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Remove optimistic message on error
      this.chatService.removeMessage(optimisticMessage.id);
      
      // Restore input on error
      this.messageContent = originalContent;
      this.selectedImages = originalImages;
      this.imagePreviews = originalPreviews;
      
    } finally {
      this.isSending = false;
    }
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  openEmojiPicker(event: MouseEvent) {
    event.stopPropagation();
    const target = event.target as HTMLElement;
    this.emojiPickerService.showPicker(event, target, (emoji: any) => {
      this.messageContent += emoji.emoji.native;
      this.messageInput.nativeElement.focus();
    });
  }

  openImagePicker() {
    this.fileInput.nativeElement.click();
  }

  async onImageSelected(event: any) {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    try {
      // For now, support single image
      const file = files[0];
      
      // Validate file type
      if (!this.ALLOWED_TYPES.includes(file.type)) {
        console.error('Invalid file type:', file.type);
        return;
      }

      // Validate file size
      if (file.size > this.MAX_FILE_SIZE) {
        console.error('File too large:', file.size);
        return;
      }

      // Generate preview
      const preview = await this.generatePreview(file);
      
      this.selectedImages = [file];
      this.imagePreviews = [preview];
      
    } catch (error) {
      console.error('Error processing image:', error);
    }
  }

  private async generatePreview(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.readAsDataURL(file);
    });
  }

  clearSelectedImages() {
    // Clean up object URLs
    this.imagePreviews.forEach(preview => {
      if (preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }
    });
    
    this.selectedImages = [];
    this.imagePreviews = [];
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  removeImage(index: number) {
    // Clean up object URL
    const preview = this.imagePreviews[index];
    if (preview && preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }
    
    this.selectedImages.splice(index, 1);
    this.imagePreviews.splice(index, 1);
  }

  isMessageFromCurrentUser(message: Message): boolean {
    return message.sender.id === this.currentUser?.id;
  }

  getMessageTimeDisplay(message: Message): string {
    const date = new Date(message.created_at);
    const now = new Date();
    
    // Check if message is from today
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      // Show just time for today's messages
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else {
      // Show date + time for messages from previous days
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + 
             ' ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
  }

  getOtherParticipant(): User | null {
    return this.conversation?.other_participant || null;
  }

  autoResize(textarea: HTMLTextAreaElement) {
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Set height to scrollHeight (content height)
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }
} 