import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { BehaviorSubject, of } from 'rxjs';

import { ProfileComponent } from './profile.component';
import { UserService } from '../../../services/user.service';
import { PostService } from '../../../services/post.service';
import { AuthService } from '../../../services/auth.service';
import { ImageUploadService } from '../../../services/image-upload.service';
import { ToastService } from '../../../services/toast.service';
import { UserPreviewModalService } from '../../../services/user-preview-modal.service';
import { TimeAgoPipe } from '../../../pipes/time-ago.pipe';
import { User } from '../../../models/user.model';
import { Post } from '../../../models/post.model';

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;
  let mockUserService: jasmine.SpyObj<UserService>;
  let mockPostService: jasmine.SpyObj<PostService>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockImageUploadService: jasmine.SpyObj<ImageUploadService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockUserPreviewModalService: jasmine.SpyObj<UserPreviewModalService>;

  const mockUser: User = {
    id: 1,
    username: 'testuser',
    handle: 'testuser',
    email: 'test@example.com',
    profile_picture: 'profile.jpg',
    banner_image: 'banner.jpg',
    bio: 'Test bio',
    location: 'Test City',
    website: 'https://test.com',
    created_at: '2024-01-01T00:00:00Z',
    date_joined: '2024-01-01T00:00:00Z',
    followers_count: 10,
    following_count: 5,
    posts_count: 20,
    is_following: false,
    is_verified: false,
    is_private: false,
    is_staff: false,
    following_only_preference: false
  };

  beforeEach(async () => {
    mockUserService = jasmine.createSpyObj('UserService', ['getUserByHandle']);
    mockPostService = jasmine.createSpyObj('PostService', ['getUserPosts', 'clearUserPosts', 'clearUserReplies'], {
      userPosts$: new BehaviorSubject<Post[]>([]),
      userReplies$: new BehaviorSubject<Post[]>([])
    });
    mockAuthService = jasmine.createSpyObj('AuthService', ['isAuthenticated'], {
      currentUser$: new BehaviorSubject<User | null>(null)
    });
    mockImageUploadService = jasmine.createSpyObj('ImageUploadService', ['upload']);
    mockToastService = jasmine.createSpyObj('ToastService', ['show']);
    mockUserPreviewModalService = jasmine.createSpyObj('UserPreviewModalService', ['open']);

    // Setup default return values
    mockUserService.getUserByHandle.and.returnValue(of(mockUser));
    mockAuthService.isAuthenticated.and.returnValue(true);

    await TestBed.configureTestingModule({
      imports: [
        ProfileComponent,
        RouterTestingModule,
        HttpClientTestingModule,
        NoopAnimationsModule,
        TimeAgoPipe
      ],
      providers: [
        { provide: UserService, useValue: mockUserService },
        { provide: PostService, useValue: mockPostService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: ImageUploadService, useValue: mockImageUploadService },
        { provide: ToastService, useValue: mockToastService },
        { provide: UserPreviewModalService, useValue: mockUserPreviewModalService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default values', () => {
    expect(component.user).toBeNull();
    expect(component.posts).toEqual([]);
    expect(component.replies).toEqual([]);
    expect(component.error).toBeNull();
    expect(component.isLoading).toBe(true);
  });

  it('should load user profile on init', () => {
    const mockUser: User = {
      id: 1,
      username: 'testuser',
      handle: 'testuser',
      email: 'test@example.com',
      bio: 'Test bio',
      profile_picture: undefined,
      banner_image: undefined,
      created_at: new Date().toISOString(),
      date_joined: new Date().toISOString(),
      followers_count: 0,
      following_count: 0,
      posts_count: 0,
      is_following: false,
      is_verified: false
    };

    mockUserService.getUserByHandle.and.returnValue(of(mockUser));

    // Mock route params
    const mockParamMap = {
      get: (param: string) => 'testuser',
      has: (param: string) => true,
      keys: ['handle']
    };

    spyOn(component['route'].paramMap, 'subscribe').and.callFake((callback: any) => {
      callback(mockParamMap);
      return { unsubscribe: () => {}, closed: false } as any;
    });

    component.ngOnInit();

    expect(mockUserService.getUserByHandle).toHaveBeenCalledWith('testuser');
  });

  it('should handle component destruction', () => {
    component.ngOnDestroy();
    expect(component).toBeTruthy();
  });
}); 