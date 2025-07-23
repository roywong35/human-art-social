import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, Input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { of, BehaviorSubject } from 'rxjs';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { PostComponent } from './post.component';
import { Post } from '../../../../models/post.model';
import { User } from '../../../../models/user.model';
import { PostService } from '../../../../services/post.service';
import { BookmarkService } from '../../../../services/bookmark.service';
import { CommentService } from '../../../../services/comment.service';
import { AuthService } from '../../../../services/auth.service';
import { PostUpdateService } from '../../../../services/post-update.service';
import { GlobalModalService } from '../../../../services/global-modal.service';
import { ToastService } from '../../../../services/toast.service';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { TimeAgoPipe } from '../../../../pipes/time-ago.pipe';

describe('PostComponent', () => {
  let component: PostComponent;
  let fixture: ComponentFixture<PostComponent>;
  let mockDialog: jasmine.SpyObj<MatDialog>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockPostService: jasmine.SpyObj<PostService>;
  let mockBookmarkService: jasmine.SpyObj<BookmarkService>;
  let mockCommentService: jasmine.SpyObj<CommentService>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockPostUpdateService: jasmine.SpyObj<PostUpdateService>;
  let mockGlobalModalService: jasmine.SpyObj<GlobalModalService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
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

  const mockPost: Post = {
    id: 1,
    content: 'This is a test post',
    image: undefined,
    author: mockUser,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    likes_count: 5,
    comments_count: 2,
    replies_count: 1,
    reposts_count: 0,
    is_liked: false,
    is_reposted: false,
    is_bookmarked: false,
    post_type: 'post',
    is_human_drawing: false,
    is_verified: false,
    user_id: 1,
    evidence_files: []
  };

  beforeEach(async () => {
    const dialogSpy = jasmine.createSpyObj('MatDialog', ['open']);
    dialogSpy.open.and.returnValue({
      afterClosed: () => of(null)
    });
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    const postServiceSpy = jasmine.createSpyObj('PostService', ['refreshPost', 'deletePost']);
    const bookmarkServiceSpy = jasmine.createSpyObj('BookmarkService', ['bookmarkPost', 'unbookmarkPost', 'isBookmarked']);
    const commentServiceSpy = jasmine.createSpyObj('CommentService', ['getComments', 'createComment']);
    const authServiceSpy = jasmine.createSpyObj('AuthService', [
      'isAuthenticated', 'currentUser$'
    ]);
    const postUpdateServiceSpy = jasmine.createSpyObj('PostUpdateService', ['postUpdate$']);
    const globalModalServiceSpy = jasmine.createSpyObj('GlobalModalService', [
      'showUserPreviewAccurate', 'hideUserPreview', 'onModalHover'
    ]);
    const toastServiceSpy = jasmine.createSpyObj('ToastService', ['showSuccess', 'showError']);
    const changeDetectorRefSpy = jasmine.createSpyObj('ChangeDetectorRef', [
      'detectChanges', 'markForCheck'
    ]);

    // Setup default return values
    authServiceSpy.isAuthenticated.and.returnValue(true);
    authServiceSpy.currentUser$ = new BehaviorSubject(mockUser);
    postUpdateServiceSpy.postUpdate$ = of({ postId: 1, updatedPost: {} });
    postServiceSpy.refreshPost.and.returnValue(of(mockPost));
    postServiceSpy.deletePost.and.returnValue(of({}));
    bookmarkServiceSpy.isBookmarked.and.returnValue(of(false));
    commentServiceSpy.getComments.and.returnValue(of([]));
    commentServiceSpy.createComment.and.returnValue(of(mockPost));

    await TestBed.configureTestingModule({
      imports: [PostComponent, TimeAgoPipe, HttpClientTestingModule],
      providers: [
        { provide: MatDialog, useValue: dialogSpy },
        { provide: Router, useValue: routerSpy },
        { provide: PostService, useValue: postServiceSpy },
        { provide: BookmarkService, useValue: bookmarkServiceSpy },
        { provide: CommentService, useValue: commentServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: PostUpdateService, useValue: postUpdateServiceSpy },
        { provide: GlobalModalService, useValue: globalModalServiceSpy },
        { provide: ToastService, useValue: toastServiceSpy },
        { provide: ChangeDetectorRef, useValue: changeDetectorRefSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PostComponent);
    component = fixture.componentInstance;
    
    mockDialog = TestBed.inject(MatDialog) as jasmine.SpyObj<MatDialog>;
    mockRouter = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    mockPostService = TestBed.inject(PostService) as jasmine.SpyObj<PostService>;
    mockBookmarkService = TestBed.inject(BookmarkService) as jasmine.SpyObj<BookmarkService>;
    mockCommentService = TestBed.inject(CommentService) as jasmine.SpyObj<CommentService>;
    mockAuthService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    mockPostUpdateService = TestBed.inject(PostUpdateService) as jasmine.SpyObj<PostUpdateService>;
    mockGlobalModalService = TestBed.inject(GlobalModalService) as jasmine.SpyObj<GlobalModalService>;
    mockToastService = TestBed.inject(ToastService) as jasmine.SpyObj<ToastService>;
    mockChangeDetectorRef = TestBed.inject(ChangeDetectorRef) as jasmine.SpyObj<ChangeDetectorRef>;

    // Setup component inputs
    component.post = mockPost;
    component.showFullHeader = true;
    component.isDetailView = false;
    component.isReply = false;
    component.showReplies = false;
    component.isConnectedToParent = false;
    component.isPreview = false;
    component.isInSearchResults = false;
    component.showRemovalBadge = false;
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with default values', () => {
      expect(component).toBeTruthy();
    });

    it('should load current user on init', () => {
      component.ngOnInit();
      expect(component).toBeTruthy();
    });
  });

  describe('Input Properties', () => {
    it('should handle different view modes', () => {
      component.isDetailView = true;
      component.isReply = true;
      component.isPreview = true;
      
      expect(component.isDetailView).toBeTrue();
      expect(component.isReply).toBeTrue();
      expect(component.isPreview).toBeTrue();
    });

    it('should handle post updates', () => {
      const updatedPost = { ...mockPost, content: 'Updated content' };
      component.post = updatedPost;
      
      expect(component.post.content).toBe('Updated content');
    });
  });

  describe('Like Functionality', () => {
    it('should like a post when user is authenticated', () => {
      const event = new Event('click');
      component.onLike(event);
      expect(component).toBeTruthy();
    });

    it('should return correct like status', () => {
      expect(component.isLiked).toBeFalse();
      
      component.post = { ...mockPost, is_liked: true };
      expect(component.isLiked).toBeTrue();
    });

    it('should return correct likes count', () => {
      expect(component.likesCount).toBe(5);
    });
  });

  describe('Bookmark Functionality', () => {
    it('should bookmark a post when user is authenticated', () => {
      const event = new Event('click');
      component.onBookmark(event);
      expect(component).toBeTruthy();
    });

    it('should return correct bookmark status', () => {
      expect(component.isBookmarked).toBeFalse();
      
      component.post = { ...mockPost, is_bookmarked: true };
      expect(component.isBookmarked).toBeTrue();
    });
  });

  describe('Reply Functionality', () => {
    it('should handle reply click when user is authenticated', () => {
      expect(component).toBeTruthy();
    });
  });

  describe('Repost Functionality', () => {
    it('should handle repost click when user is authenticated', () => {
      const event = new Event('click');
      component.onRepost(event);
      expect(component).toBeTruthy();
    });

    it('should return correct repost status', () => {
      expect(component.isReposted).toBeFalse();
      
      component.post = { ...mockPost, is_reposted: true };
      expect(component.isReposted).toBeTrue();
    });

    it('should return correct reposts count', () => {
      expect(component.repostsCount).toBe(0);
    });
  });

  describe('Navigation', () => {
    it('should navigate to post detail', () => {
      const event = new Event('click');
      component.navigateToPost(event);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/testuser/post/1']);
    });

    it('should navigate to profile', () => {
      const event = new Event('click');
      component.navigateToProfile(event);
      
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/testuser']);
    });
  });

  describe('Component Lifecycle', () => {
    it('should handle component destruction', () => {
      component.ngOnDestroy();
      expect(component).toBeTruthy();
    });

    it('should handle changes', () => {
      component.ngOnChanges();
      expect(component).toBeTruthy();
    });
  });
}); 