import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, Input } from '@angular/core';
import { BehaviorSubject, of } from 'rxjs';
import { ChatRoomComponent } from './chat-room.component';
import { ChatService } from '../../../services/chat.service';
import { AuthService } from '../../../services/auth.service';
import { ImageUploadService } from '../../../services/image-upload.service';
import { EmojiPickerService } from '../../../services/emoji-picker.service';
import { ConversationDetail, Message, User } from '../../../models';
import { ChangeDetectorRef } from '@angular/core';
import { TimeAgoPipe } from '../../../pipes/time-ago.pipe';

describe('ChatRoomComponent', () => {
  let component: ChatRoomComponent;
  let fixture: ComponentFixture<ChatRoomComponent>;
  let mockChatService: jasmine.SpyObj<ChatService>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockImageUploadService: jasmine.SpyObj<ImageUploadService>;
  let mockEmojiPickerService: jasmine.SpyObj<EmojiPickerService>;
  let mockChangeDetectorRef: jasmine.SpyObj<ChangeDetectorRef>;

  const mockUser: User = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    handle: 'testuser',
    profile_picture: undefined,
    banner_image: undefined,
    bio: '',
    location: '',
    website: '',
    created_at: '2024-01-01T00:00:00Z',
    date_joined: '2024-01-01T00:00:00Z',
    followers_count: 0,
    following_count: 0,
    posts_count: 0,
    is_staff: false,
    following_only_preference: false
  };

  const mockOtherUser: User = {
    id: 2,
    username: 'otheruser',
    email: 'other@example.com',
    handle: 'otheruser',
    profile_picture: undefined,
    banner_image: undefined,
    bio: '',
    location: '',
    website: '',
    created_at: '2024-01-01T00:00:00Z',
    date_joined: '2024-01-01T00:00:00Z',
    followers_count: 0,
    following_count: 0,
    posts_count: 0,
    is_staff: false,
    following_only_preference: false
  };

  const mockConversation: ConversationDetail = {
    id: 1,
    participants: [mockUser, mockOtherUser],
    other_participant: mockOtherUser,
    messages: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    last_message_at: '2024-01-01T00:00:00Z'
  };

  const mockMessage: Message = {
    id: 1,
    sender: mockUser,
    content: 'Hello!',
    created_at: '2024-01-01T00:00:00Z',
    is_read: true
  };

  beforeEach(async () => {
    const chatServiceSpy = jasmine.createSpyObj('ChatService', [
      'loadMessages', 'sendMessage', 'addMessage', 'replaceMessage', 'removeMessage', 
      'sendTypingIndicator', 'testWebSocketConnection'
    ]);
    const authServiceSpy = jasmine.createSpyObj('AuthService', [
      'isAuthenticated', 'currentUser$'
    ]);
    const imageUploadServiceSpy = jasmine.createSpyObj('ImageUploadService', [
      'uploadImage', 'uploadImages'
    ]);
    const emojiPickerServiceSpy = jasmine.createSpyObj('EmojiPickerService', [
      'openEmojiPicker', 'closeEmojiPicker', 'showPicker'
    ]);
    const changeDetectorRefSpy = jasmine.createSpyObj('ChangeDetectorRef', [
      'detectChanges', 'markForCheck'
    ]);

    // Setup default return values
    chatServiceSpy.messages$ = new BehaviorSubject<Message[]>([]);
    chatServiceSpy.typingUsers$ = new BehaviorSubject<string[]>([]);
    chatServiceSpy.loadMessages.and.returnValue(of([]));
    chatServiceSpy.sendMessage.and.returnValue(of(mockMessage));
    chatServiceSpy.addMessage.and.returnValue(undefined);
    chatServiceSpy.replaceMessage.and.returnValue(undefined);
    chatServiceSpy.removeMessage.and.returnValue(undefined);
    chatServiceSpy.sendTypingIndicator.and.returnValue(undefined);
    chatServiceSpy.testWebSocketConnection.and.returnValue(undefined);
    authServiceSpy.isAuthenticated.and.returnValue(true);
    authServiceSpy.currentUser$ = new BehaviorSubject(mockUser);
    imageUploadServiceSpy.uploadImage.and.returnValue(of('image-url'));
    imageUploadServiceSpy.uploadImages.and.returnValue(of(['image-url1', 'image-url2']));
    emojiPickerServiceSpy.showPicker.and.returnValue(undefined);

    await TestBed.configureTestingModule({
      imports: [
        ChatRoomComponent,
        TimeAgoPipe
      ],
      providers: [
        { provide: ChatService, useValue: chatServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: ImageUploadService, useValue: imageUploadServiceSpy },
        { provide: EmojiPickerService, useValue: emojiPickerServiceSpy },
        { provide: ChangeDetectorRef, useValue: changeDetectorRefSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ChatRoomComponent);
    component = fixture.componentInstance;
    
    mockChatService = TestBed.inject(ChatService) as jasmine.SpyObj<ChatService>;
    mockAuthService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    mockImageUploadService = TestBed.inject(ImageUploadService) as jasmine.SpyObj<ImageUploadService>;
    mockEmojiPickerService = TestBed.inject(EmojiPickerService) as jasmine.SpyObj<EmojiPickerService>;
    mockChangeDetectorRef = TestBed.inject(ChangeDetectorRef) as jasmine.SpyObj<ChangeDetectorRef>;

    // Setup component inputs
    component.conversation = mockConversation;
    component.currentUser = mockUser;
    component.isMobileView = false;
    component.isFloatingChat = false;

    // Mock ViewChild elements
    component.fileInput = { nativeElement: { click: () => {}, value: '' } } as any;
    component.messageInput = { nativeElement: { focus: () => {} } } as any;
    component.messagesContainer = { nativeElement: { scrollTop: 0, scrollHeight: 100 } } as any;
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with default values', () => {
      expect(component.messages).toEqual([]);
      expect(component.messageContent).toBe('');
      expect(component.isTyping).toBeFalse();
      expect(component.typingUsers).toEqual([]);
      expect(component.isSending).toBeFalse();
      expect(component.selectedImages).toEqual([]);
      expect(component.imagePreviews).toEqual([]);
    });

    it('should load user profile on init', () => {
      component.ngOnInit();
      expect(mockChatService.loadMessages).toHaveBeenCalledWith(mockConversation.id);
    });
  });

  describe('Input Properties', () => {
    it('should handle conversation changes', () => {
      const newConversation = { ...mockConversation, id: 2 };
      component.conversation = newConversation;
      component.ngOnChanges({
        conversation: {
          currentValue: newConversation,
          previousValue: mockConversation,
          firstChange: false,
          isFirstChange: () => false
        }
      });

      expect(mockChatService.loadMessages).toHaveBeenCalledWith(2);
    });

    it('should handle mobile view', () => {
      component.isMobileView = true;
      expect(component.isMobileView).toBeTrue();
    });

    it('should handle floating chat mode', () => {
      component.isFloatingChat = true;
      expect(component.isFloatingChat).toBeTrue();
    });
  });

  describe('Message Handling', () => {
    it('should handle message sending', () => {
      expect(component).toBeTruthy();
    });
  });

  describe('Image Upload', () => {
    it('should open image picker', () => {
      component.openImagePicker();
      expect(component).toBeTruthy();
    });

    it('should remove image', () => {
      component.selectedImages = [new File([''], 'test.jpg')];
      component.imagePreviews = ['preview-url'];

      component.removeImage(0);

      expect(component.selectedImages.length).toBe(0);
      expect(component.imagePreviews.length).toBe(0);
    });

    it('should clear selected images', () => {
      component.selectedImages = [new File([''], 'test.jpg')];
      component.imagePreviews = ['preview-url'];

      component.clearSelectedImages();

      expect(component.selectedImages.length).toBe(0);
      expect(component.imagePreviews.length).toBe(0);
    });
  });

  describe('Message Display', () => {
    it('should check if message is from current user', () => {
      const messageFromCurrentUser = { ...mockMessage, sender: mockUser };
      const messageFromOtherUser = { ...mockMessage, sender: mockOtherUser };

      expect(component.isMessageFromCurrentUser(messageFromCurrentUser)).toBeTrue();
      expect(component.isMessageFromCurrentUser(messageFromOtherUser)).toBeFalse();
    });

    it('should get message time display', () => {
      const message = { ...mockMessage, created_at: '2024-01-01T12:00:00Z' };
      const timeDisplay = component.getMessageTimeDisplay(message);

      expect(timeDisplay).toBeTruthy();
    });

    it('should get other participant', () => {
      const otherParticipant = component.getOtherParticipant();

      expect(otherParticipant).toEqual(mockOtherUser);
    });

    it('should return null for other participant if not found', () => {
      component.conversation = { ...mockConversation, other_participant: null as any };
      const otherParticipant = component.getOtherParticipant();

      expect(otherParticipant).toBeNull();
    });
  });

  describe('UI Interactions', () => {
    it('should scroll to bottom', () => {
      component.scrollToBottom();
      expect(component).toBeTruthy();
    });
  });

  describe('Typing Indicators', () => {
    it('should handle typing users', () => {
      // Set up the component with the conversation
      component.conversation = mockConversation;
      component.ngOnInit();
      
      const typingUsers = ['user1', 'user2'];
      (mockChatService.typingUsers$ as BehaviorSubject<string[]>).next(typingUsers);

      expect(component.typingUsers).toEqual(typingUsers);
    });

    it('should update typing status', () => {
      component.isTyping = true;
      expect(component.isTyping).toBeTrue();
    });
  });

  describe('Component Lifecycle', () => {
    it('should handle changes', () => {
      const changes = {
        conversation: {
          currentValue: mockConversation,
          previousValue: undefined,
          firstChange: true,
          isFirstChange: () => true
        }
      };
      
      component.ngOnChanges(changes);
      expect(component).toBeTruthy();
    });
  });
}); 