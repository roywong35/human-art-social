import { Component, OnInit, OnDestroy, Inject, ChangeDetectorRef, HostListener, NgZone, ViewChildren, QueryList, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ActivatedRoute, Router } from '@angular/router';
import { User } from '../../../models/user.model';
import { Post } from '../../../models/post.model';
import { UserService } from '../../../services/user.service';
import { OptimisticUpdateService } from '../../../services/optimistic-update.service';
import { PostService } from '../../../services/post.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { SidebarService } from '../../../services/sidebar.service';
import { PostComponent } from '../../features/posts/post/post.component';
import { take } from 'rxjs/operators';
import { MatDialog, MatDialogModule} from '@angular/material/dialog';
import { UserListDialogComponent } from '../../dialogs/user-list-dialog/user-list-dialog.component';
import { Subscription } from 'rxjs';
import { UnfollowDialogComponent } from '../../dialogs/unfollow-dialogs/unfollow-dialog.component';

// Hammer.js imports
import Hammer from 'hammerjs';


@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    RouterModule, 
    PostComponent, 
    MatDialogModule
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit, OnDestroy {
  @ViewChildren(PostComponent) postComponents!: QueryList<PostComponent>;
  private routeSubscription: Subscription | undefined;
  private userPostsSubscription: Subscription | undefined;
  private subscriptions = new Subscription();
  
  // Note: Removed component-level caching arrays
  // Now using service-level caching for persistence across page navigation
  
  user: User | null = null;
  posts: Post[] = [];
  replies: Post[] = [];
  replyParentChains: { [replyId: number]: Post[] } = {};
  mediaItems: { image: string; postId: number }[] = [];
  humanArtPosts: Post[] = [];
  likedPosts: Post[] = [];
  activeTab: 'posts' | 'replies' | 'media' | 'human-art' | 'likes' = 'posts';
  isLoading = false;
  isLoadingMorePosts = false;
  isLoadingMoreReplies = false;
  isLoadingMedia = false;
  isLoadingHumanArt = false;
  isLoadingLikes = false;
  isRefreshing = false; // For pull-to-refresh only
  error: string | null = null;
  isCurrentUser = false;
  showEditModal = false;
  isFollowLoading = false;
  isHoveringFollowButton = false;
  private scrollThrottleTimeout: any;
  private currentHandle: string | null = null;
  
  // Mobile detection - make it a getter for real-time detection
  get isMobile(): boolean {
    const mobile = window.innerWidth < 768;
    return mobile;
  }
  
  // Swipe gesture properties
  private hammerManager?: HammerManager;
  
  // Touch event handler properties for cleanup
  private handleTouchStart!: (e: Event) => void;
  private handleTouchMove!: (e: Event) => void;
  private handleTouchEnd!: () => void;
  
  // Note: Removed old component-level caching methods
  // Now using service-level caching for persistence across page navigation

  /**
   * Check if service has cached content for a specific tab
   */
  private checkServiceCache(tab: 'posts' | 'replies' | 'media' | 'human-art' | 'likes'): boolean {
    if (!this.user?.handle) return false;
    
    let hasCache = false;
    
    switch (tab) {
      case 'posts':
        // Posts and replies use different caching mechanism in PostService
        // Check if we have current posts loaded OR if the service has cached posts
        hasCache = this.posts.length > 0 || this.postService.hasCachedUserPosts();
        return hasCache;
      case 'replies':
        hasCache = this.replies.length > 0 || this.postService.hasCachedUserReplies();
        return hasCache;
      case 'media':
        hasCache = this.postService.hasCachedProfileData(this.user.handle, 'media');
        return hasCache;
      case 'human-art':
        hasCache = this.postService.hasCachedProfileData(this.user.handle, 'humanArt');
        return hasCache;
      case 'likes':
        hasCache = this.postService.hasCachedProfileData(this.user.handle, 'likes');
        return hasCache;
      default:
        return false;
    }
  }

  /**
   * Load content from service cache for a specific tab
   */
  private loadFromServiceCache(tab: 'posts' | 'replies' | 'media' | 'human-art' | 'likes'): void {
    if (!this.user?.handle) return;
    
    switch (tab) {
      case 'posts':
        // Posts are already loaded via subscription in constructor
        // If we have cached posts but they're not loaded yet, trigger a load
        if (this.posts.length === 0 && this.postService.hasCachedUserPosts()) {
          this.postService.getUserPosts(this.user.handle);
        }
        // Loading state is managed by service
        this.cd.markForCheck();
        break;
      case 'replies':
        // Replies are already loaded via subscription in constructor
        // If we have cached replies but they're not loaded yet, trigger a load
        if (this.replies.length === 0 && this.postService.hasCachedUserReplies()) {
          this.postService.getUserReplies(this.user.handle);
        }
        // Loading state is managed by service
        this.cd.markForCheck();
        break;
      case 'media':
        // Load from service cache
        this.postService.getUserMedia(this.user.handle).subscribe(posts => {
          this.mediaItems = posts.reduce((acc: { image: string; postId: number }[], post: Post) => {
            const images = post.images?.map(img => ({
              image: img.image,
              postId: post.id
            })) || [];
            return [...acc, ...images];
          }, []);
          // Set loading state to false after loading from cache
          this.isLoadingMedia = false;
          this.cd.markForCheck();
        });
        break;
      case 'human-art':
        this.postService.getUserHumanArt(this.user.handle).subscribe(posts => {
          this.humanArtPosts = posts.filter(post => post.is_verified);
          // Set loading state to false after loading from cache
          this.isLoadingHumanArt = false;
          this.cd.markForCheck();
        });
        break;
      case 'likes':
        this.postService.getUserLikes(this.user.handle).subscribe(posts => {
          this.likedPosts = posts;
          // Set loading state to false after loading from cache
          this.isLoadingLikes = false;
          this.cd.markForCheck();
        });
        break;
    }
  }

  // Note: Removed showCachedContent method - no longer needed with service-level caching
  
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';
  editForm = {
    username: '',
    bio: '',
    profile_picture: null as File | null,
    banner_image: null as File | null,
    profile_picture_preview: '',
    banner_image_preview: ''
  };

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private userService: UserService,
    private optimisticUpdateService: OptimisticUpdateService,
    public postService: PostService,
    private toastService: ToastService,
    private authService: AuthService,
    private sidebarService: SidebarService,
    private dialog: MatDialog,
    private cd: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    // Subscribe to user posts stream just like homepage - in constructor
    this.subscriptions.add(
      this.postService.userPosts$.subscribe({
        next: (posts: Post[]) => {
          if (!posts) {
            this.posts = [];
          } else {
            // Always replace posts array to ensure change detection
            this.posts = [...posts];
          }
          
          this.isLoadingMorePosts = false;
          this.cd.markForCheck();
        },
        error: (error: Error) => {
          console.error('Error loading posts:', error);
          this.error = 'Failed to load posts';
          this.posts = [];
          this.isLoadingMorePosts = false;
          this.cd.markForCheck();
        }
      })
    );

    // Subscribe to user replies stream just like posts
    this.subscriptions.add(
      this.postService.userReplies$.subscribe({
        next: async (replies: Post[]) => {
          if (!replies) {
            this.replies = [];
          } else {
            // Always replace replies array to ensure change detection
            this.replies = [...replies];
            
            // Build parent chains only for newly received replies (much faster!)
            for (const reply of this.replies) {
              if (!this.replyParentChains[reply.id]) {
                await this.buildParentChain(reply);
              }
            }
          }
          
          this.isLoadingMoreReplies = false;
          this.cd.markForCheck();
        },
        error: (error: Error) => {
          console.error('Error loading replies:', error);
          this.error = 'Failed to load replies';
          this.replies = [];
          this.isLoadingMoreReplies = false;
          this.cd.markForCheck();
        }
      })
    );
  }

  ngOnInit(): void {
    // Subscribe to route changes to handle tab switching
    this.route.queryParamMap.subscribe(params => {
      const tab = params.get('tab') as 'posts' | 'replies' | 'media' | 'human-art' | 'likes';
      if (tab && tab !== this.activeTab) {
        this.setActiveTab(tab);
      }
    });

    // Get user handle from route params
    this.route.params.subscribe(params => {
      const handle = params['handle'];
      if (handle) {
        this.loadUserProfile(handle);
      }
    });

    // Subscribe to follow status changes from other components
    this.setupFollowStatusSync();
    
    // Don't initialize gestures here - wait for content to load like home component does
  }

  ngOnDestroy(): void {
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
    if (this.userPostsSubscription) {
      this.userPostsSubscription.unsubscribe();
    }
    this.subscriptions.unsubscribe();
    if (this.scrollThrottleTimeout) {
      clearTimeout(this.scrollThrottleTimeout);
    }
    
    // Clean up Hammer.js instance if it exists
    if (this.hammerManager) {
      this.hammerManager.destroy();
    }
    
    // Clean up touch event listeners
    if (this.handleTouchStart && this.handleTouchMove && this.handleTouchEnd) {
      document.body.removeEventListener('touchstart', this.handleTouchStart);
      document.body.removeEventListener('touchmove', this.handleTouchMove);
      document.body.removeEventListener('touchend', this.handleTouchEnd);
    }
    
    // Note: We don't clear any caches here anymore
    // All caches (user posts, replies, media, human art, likes) will persist across page navigation
    // This allows for instant loading when returning to the profile page
    // Caches will only expire after their respective timeouts (10 minutes for profile data)
  }

  private setupFollowStatusSync(): void {
    // Subscribe to follow status changes from other components (like user preview modal)
    // This is for when viewing someone else's profile - their follow status changes
    this.subscriptions.add(this.optimisticUpdateService.followStatusChanges.subscribe(change => {
      if (change && this.user && change.userHandle === this.user.handle) {
        // Update the user's follow status and followers count
        this.user.is_following = change.isFollowing;
        this.user.followers_count = change.followersCount;
        
        // Trigger change detection to update the UI
        this.cd.markForCheck();
      }
    }));

    // Subscribe to following count changes ONLY when viewing your own profile
    // This is for when viewing your own profile - your following count changes
    this.subscriptions.add(this.optimisticUpdateService.followingCountChanges.subscribe(change => {
      if (change && this.user && this.isCurrentUser && change.currentUserHandle === this.user.handle) {
        // Update the current user's following count
        this.user.following_count = change.followingCount;
        
        // Trigger change detection to update the UI
        this.cd.markForCheck();
      }
    }));
  }

  private loadUserProfile(handle: string): void {
    // Only set loading if we don't have cached user data
    if (!this.user || this.user.handle !== handle) {
      // Use a shorter delay to avoid race conditions with fast-loading user data
      setTimeout(() => {
        this.isLoading = true;
        this.cd.markForCheck();
      }, 50); // Reduced to 50ms for better responsiveness
    }
    this.error = null;

    this.userService.getUserByHandle(handle).subscribe({
      next: (user) => {
        this.user = user;
        this.isLoading = false;
        this.cd.markForCheck();
        this.cd.detectChanges(); // Force immediate change detection
        // Force isLoading to false again after change detection
        setTimeout(() => {
          this.isLoading = false;
          this.cd.markForCheck();
        }, 0);
        this.loadTabContent(handle);
        
        // Initialize gesture support after content loads
        if (this.isMobile) {
          setTimeout(() => {
            this.initializeGestureSupport();
          }, 100);
        }
      },
      error: (error) => {
        console.error('Error loading user profile:', error);
        this.error = 'Failed to load profile';
        this.isLoading = false;
      }
    });
  }

  setActiveTab(tab: 'posts' | 'replies' | 'media' | 'human-art' | 'likes'): void {
    this.activeTab = tab;
    
    // Check if the target tab has service-level cached content
    const hasServiceCache = this.checkServiceCache(tab);
    
    if (hasServiceCache) {
      // Tab has service-level cached content - show instantly without loading
      this.loadFromServiceCache(tab);
      // Set all loading states to false immediately for cached content
      this.isLoadingMedia = false;
      this.isLoadingHumanArt = false;
      this.isLoadingLikes = false;
    } else {
      // Tab has no cached content - show loading state
      switch (tab) {
        case 'media':
          this.isLoadingMedia = true;
          break;
        case 'human-art':
          this.isLoadingHumanArt = true;
          break;
        case 'likes':
          this.isLoadingLikes = true;
          break;
      }
    }
    
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge'
    });
    
    // Only load content if the target tab has no cached content
    if (!hasServiceCache) {
      this.loadTabContent(this.user?.handle || '');
    }
  }

  private loadTabContent(handle: string): void {
    if (!handle) return;

    // Check if we have cached content for the current tab
    const hasServiceCache = this.checkServiceCache(this.activeTab);

    if (hasServiceCache) {
      // We have cached content, load it instantly
      this.loadFromServiceCache(this.activeTab);
      // Also set main loading state to false since we're using cache
      this.isLoading = false;
      return;
    }

    // Only set loading flags if this is not a refresh operation
    if (!this.isRefreshing) {
      console.log('[Profile] No cache found, loading from API');
      switch (this.activeTab) {
        case 'posts':
          this.loadUserPosts(handle);
          break;
        case 'replies':
          this.loadUserReplies(handle);
          break;
        case 'media':
          this.isLoadingMedia = true;
          this.loadUserMedia(handle);
          break;
        case 'human-art':
          this.isLoadingHumanArt = true;
          this.loadUserHumanArt(handle);
          break;
        case 'likes':
          this.isLoadingLikes = true;
          this.loadUserLikes(handle);
          break;
      }
    } else {
      // For refresh operations, use force refresh methods
      switch (this.activeTab) {
        case 'posts':
          this.loadUserPosts(handle);
          break;
        case 'replies':
          this.loadUserReplies(handle);
          break;
        case 'media':
          this.forceRefreshUserMedia(handle);
          break;
        case 'human-art':
          this.forceRefreshUserHumanArt(handle);
          break;
        case 'likes':
          this.forceRefreshUserLikes(handle);
          break;
      }
    }
    
    // Clear refreshing state after a short delay to ensure content loads
    if (this.isRefreshing) {
      setTimeout(() => {
        this.isRefreshing = false;
        this.cd.markForCheck();
      }, 500); // Increased delay to ensure content loads properly
    }
    
    // Fallback gesture initialization if needed
    if (this.isMobile && !this.hammerManager) {
      this.initializeGestureSupport();
    }
  }

  private loadUserPosts(handle: string): void {
    this.error = null;
    
    // Only clear posts if switching users
    if (this.currentHandle !== handle) {
      this.posts = [];
    }
    
    this.currentHandle = handle;

    
    // Just trigger the load - we're already subscribed to userPosts$ in constructor
    this.postService.getUserPosts(handle, true); // true = refresh
  }

  private loadUserReplies(handle: string): void {
    this.error = null;
    
    // Only clear replies if switching users
    if (this.currentHandle !== handle) {
      this.replies = [];
    }
    

    
    // Just trigger the load - we're already subscribed to userReplies$ in constructor
    this.postService.getUserReplies(handle, true); // true = refresh
  }

  private async buildParentChain(reply: Post) {
    // Initialize empty chain for this reply
    this.replyParentChains[reply.id] = [];

    // Use conversation_chain to build the parent chain
    if (reply.conversation_chain && reply.conversation_chain.length > 0) {
      // Get all posts except the last one (which is the current reply)
      const chainIds = reply.conversation_chain.slice(0, -1);

      for (const postId of chainIds) {
        try {
          // Use getPostById since parent posts can be from different users
          const chainPost = await this.postService.getPostById(postId).toPromise();
          if (chainPost) {
            this.replyParentChains[reply.id].push(chainPost);
          }
        } catch (error) {
          console.error(`Error loading parent post ${postId}:`, error);
        }
      }
    }
  }

  private loadUserMedia(handle: string): void {
    // Only set loading state if this is not a refresh operation and no cached content
    if (!this.isRefreshing && !this.postService.hasCachedProfileData(handle, 'media')) {
      this.isLoadingMedia = true;
    }
    this.error = null;
    
    this.postService.getUserMedia(handle).subscribe({
      next: (posts: Post[]) => {
        this.mediaItems = posts.reduce((acc: { image: string; postId: number }[], post: Post) => {
          const images = post.images?.map(img => ({
            image: img.image,
            postId: post.id
          })) || [];
          return [...acc, ...images];
        }, []);
        this.isLoadingMedia = false;
        
        this.cd.markForCheck();
      },
      error: (error: Error) => {
        console.error('Error loading media:', error);
        this.error = 'Failed to load media';
        this.isLoadingMedia = false;
        this.cd.markForCheck();
      }
    });
  }

  private forceRefreshUserMedia(handle: string): void {
    // Force refresh media (for pull-to-refresh)
    this.isRefreshing = true;
    this.isLoadingMedia = true;
    this.postService.getUserMedia(handle, true).subscribe({
      next: (posts: Post[]) => {
        this.mediaItems = posts.reduce((acc: { image: string; postId: number }[], post: Post) => {
          const images = post.images?.map(img => ({
            image: img.image,
            postId: post.id
          })) || [];
          return [...acc, ...images];
        }, []);
        this.isLoadingMedia = false;
        this.isRefreshing = false;
        
        this.cd.markForCheck();
      },
      error: (error: Error) => {
        console.error('Error loading media:', error);
        this.error = 'Failed to load media';
        this.isLoadingMedia = false;
        this.isRefreshing = false;
        this.cd.markForCheck();
      }
    });
  }

  private loadUserHumanArt(handle: string): void {
    // Only set loading state if this is not a refresh operation and no cached content
    if (!this.isRefreshing && !this.postService.hasCachedProfileData(handle, 'humanArt')) {
      this.isLoadingHumanArt = true;
    }
    this.error = null;
    
    this.postService.getUserHumanArt(handle).subscribe({
      next: (posts: Post[]) => {
        this.humanArtPosts = posts.filter(post => post.is_verified);
        this.isLoadingHumanArt = false;
        
        this.cd.markForCheck();
      },
      error: (error: Error) => {
        console.error('Error loading human art:', error);
        this.error = 'Failed to load human art';
        this.isLoadingHumanArt = false;
        this.cd.markForCheck();
      }
    });
  }

  private loadUserLikes(handle: string): void {
    // Only set loading state if this is not a refresh operation and no cached content
    if (!this.isRefreshing && !this.postService.hasCachedProfileData(handle, 'likes')) {
      this.isLoadingLikes = true;
    }
    this.error = null;
    
    this.postService.getUserLikes(handle).subscribe({
      next: (posts: Post[]) => {
        this.likedPosts = posts;
        this.isLoadingLikes = false;
        
        this.cd.markForCheck();
      },
      error: (error: Error) => {
        console.error('Error loading likes:', error);
        this.error = 'Failed to load likes';
        this.isLoadingLikes = false;
        this.cd.markForCheck();
      }
    });
  }

  private forceRefreshUserHumanArt(handle: string): void {
    // Force refresh human art (for pull-to-refresh)
    this.isRefreshing = true;
    this.isLoadingHumanArt = true;
    this.postService.getUserHumanArt(handle, true).subscribe({
      next: (posts: Post[]) => {
        this.humanArtPosts = posts.filter(post => post.is_verified);
        this.isLoadingHumanArt = false;
        this.isRefreshing = false;
        
        this.cd.markForCheck();
      },
      error: (error: Error) => {
        console.error('Error loading human art:', error);
        this.error = 'Failed to load human art';
        this.isLoadingHumanArt = false;
        this.isRefreshing = false;
        this.cd.markForCheck();
      }
    });
  }

  private forceRefreshUserLikes(handle: string): void {
    // Force refresh likes (for pull-to-refresh)
    this.isRefreshing = true;
    this.isLoadingLikes = true;
    this.postService.getUserLikes(handle, true).subscribe({
      next: (posts: Post[]) => {
        this.likedPosts = posts;
        this.isLoadingLikes = false;
        this.isRefreshing = false;
        
        this.cd.markForCheck();
      },
      error: (error: Error) => {
        console.error('Error loading likes:', error);
        this.error = 'Failed to load likes';
        this.isLoadingLikes = false;
        this.isRefreshing = false;
        this.cd.markForCheck();
      }
    });
  }

  onBannerImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.editForm.banner_image = input.files[0];
      this.editForm.banner_image_preview = URL.createObjectURL(input.files[0]);
    }
  }

  onProfilePictureSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.editForm.profile_picture = input.files[0];
      this.editForm.profile_picture_preview = URL.createObjectURL(input.files[0]);
    }
  }

  openEditModal(): void {
    if (this.user) {
      this.editForm.username = this.user.username;
      this.editForm.bio = this.user.bio || '';
      this.editForm.profile_picture_preview = this.user.profile_picture || '';
      this.editForm.banner_image_preview = this.user.banner_image || '';
    }
    this.showEditModal = true;
  }

  closeEditModal(): void {
    // Revoke object URLs to prevent memory leaks
    if (this.editForm.profile_picture_preview && this.editForm.profile_picture_preview.startsWith('blob:')) {
      URL.revokeObjectURL(this.editForm.profile_picture_preview);
    }
    if (this.editForm.banner_image_preview && this.editForm.banner_image_preview.startsWith('blob:')) {
      URL.revokeObjectURL(this.editForm.banner_image_preview);
    }
    
    this.showEditModal = false;
    this.editForm = {
      username: '',
      bio: '',
      profile_picture: null,
      banner_image: null,
      profile_picture_preview: '',
      banner_image_preview: ''
    };
  }

  saveProfile(): void {
    if (!this.user) return;

    const formData = new FormData();
    formData.append('username', this.editForm.username);
    formData.append('bio', this.editForm.bio);
    
    if (this.editForm.profile_picture) {
      formData.append('profile_picture', this.editForm.profile_picture);
    }
    if (this.editForm.banner_image) {
      formData.append('banner_image', this.editForm.banner_image);
    }

    this.userService.updateProfile(this.user.handle, formData).subscribe({
      next: (updatedUser) => {
        this.user = updatedUser;
        this.closeEditModal();
        this.toastService.showSuccess('Profile updated successfully');
      },
      error: (error) => {
        console.error('Error updating profile:', error);
        this.toastService.showError('Failed to update profile');
      }
    });
  }

  async followUser(): Promise<void> {
    if (!this.user || this.isFollowLoading) return;

    // If already following, show confirmation dialog
    if (this.user.is_following) {
      const dialogRef = this.dialog.open(UnfollowDialogComponent, {
        width: '400px',
        data: { handle: this.user.handle },
        panelClass: 'unfollow-dialog-fixed'
      });

      const result = await dialogRef.afterClosed().pipe(take(1)).toPromise();
      if (!result) return; // User cancelled
      
      // User confirmed unfollow - apply optimistic update immediately
      this.isFollowLoading = true;
      
      // Apply optimistic update immediately for instant UI feedback
      if (this.user) {
        this.user = {
          ...this.user,
          is_following: false,
          followers_count: Math.max((this.user.followers_count || 0) - 1, 0)
        };
        this.cd.markForCheck();
      }
      
      // Make the unfollow API call
      this.optimisticUpdateService.unfollowUserOptimistic(this.user!).subscribe({
        next: (updatedUser) => {
          // API call successful - no need to update UI again
          this.isFollowLoading = false;
          this.cd.markForCheck();
        },
        error: (error) => {
          console.error('Error unfollowing user:', error);
          // Revert optimistic update on error
          if (this.user) {
            this.user = {
              ...this.user,
              is_following: true,
              followers_count: (this.user.followers_count || 0) + 1
            } as User;
          }
          this.isFollowLoading = false;
          this.toastService.showError('Failed to update follow status');
          this.cd.markForCheck();
        }
      });
      return; // Exit early since we handled unfollow
    }

    // User is not following - apply optimistic update immediately
    this.isFollowLoading = true;
    
    // Apply optimistic update immediately for instant UI feedback
    if (this.user) {
      this.user = {
        ...this.user,
        is_following: true,
        followers_count: (this.user.followers_count || 0) + 1
      };
      this.cd.markForCheck();
    }
    
    // Make the follow API call
    this.optimisticUpdateService.followUserOptimistic(this.user!).subscribe({
      next: (updatedUser) => {
        // API call successful - no need to update UI again
        this.isFollowLoading = false;
        this.cd.markForCheck();
      },
              error: (error) => {
        console.error('Error following user:', error);
        // Revert optimistic update on error
        if (this.user) {
          this.user = {
            ...this.user,
            is_following: false,
            followers_count: Math.max((this.user.followers_count || 0) - 1, 0)
          } as User;
        }
        this.isFollowLoading = false;
        this.toastService.showError('Failed to update follow status');
        this.cd.markForCheck();
      }
    });
  }

  onPostClick(post: Post): void {
    this.router.navigate([`/${post.author.handle}/post/${post.id}`]);
  }

  onPostUpdated(updatedPost: Post): void {
    this.ngZone.run(() => {
      // Update posts array
      this.posts = this.posts.map(post => {
        if (post.id === updatedPost.id) {
          return { ...post, replies_count: updatedPost.replies_count };
        }
        if (post.post_type === 'repost' && post.referenced_post?.id === updatedPost.id) {
          return {
            ...post,
            referenced_post: { ...post.referenced_post, replies_count: updatedPost.replies_count }
          };
        }
        return post;
      });

      // Update replies array
      this.replies = this.replies.map(post => {
        if (post.id === updatedPost.id) {
          return { ...post, replies_count: updatedPost.replies_count };
        }
        if (post.post_type === 'repost' && post.referenced_post?.id === updatedPost.id) {
          return {
            ...post,
            referenced_post: { ...post.referenced_post, replies_count: updatedPost.replies_count }
          };
        }
        return post;
      });

      // Update liked posts array
      this.likedPosts = this.likedPosts.map(post => {
        if (post.id === updatedPost.id) {
          return { ...post, replies_count: updatedPost.replies_count };
        }
        if (post.post_type === 'repost' && post.referenced_post?.id === updatedPost.id) {
          return {
            ...post,
            referenced_post: { ...post.referenced_post, replies_count: updatedPost.replies_count }
          };
        }
        return post;
      });

      this.cd.markForCheck();
    });
  }

  onFollowButtonHover(isHovering: boolean): void {
    this.isHoveringFollowButton = isHovering;
  }

  showFollowers(event: Event): void {
    event.preventDefault();
    if (!this.user) return;

    this.userService.getUserFollowers(this.user.handle).subscribe(followers => {
      this.dialog.open(UserListDialogComponent, {
        data: {
          users: followers,
          title: 'Followers'
        },
        panelClass: 'rounded-lg'
      });
    });
  }

  showFollowing(event: Event): void {
    event.preventDefault();
    if (!this.user) return;

    this.userService.getUserFollowing(this.user.handle).subscribe(following => {
      this.dialog.open(UserListDialogComponent, {
        data: {
          users: following,
          title: 'Following'
        },
        panelClass: 'rounded-lg'
      });
    });
  }

  onMediaClick(media: { image: string; postId: number }): void {
    this.router.navigate(['/', this.user?.handle, 'post', media.postId]);
  }

  onPostReported(postId: number): void {
    // Remove the reported post from the current tab's posts
    if (this.activeTab === 'posts') {
      this.posts = this.posts.filter(post => post.id !== postId);
    } else if (this.activeTab === 'replies') {
      this.replies = this.replies.filter(reply => reply.id !== postId);
    } else if (this.activeTab === 'human-art') {
      this.humanArtPosts = this.humanArtPosts.filter(post => post.id !== postId);
    } else if (this.activeTab === 'likes') {
      this.likedPosts = this.likedPosts.filter(post => post.id !== postId);
    }
  }

  onLike(post: Post): void {
    const originalPost = post.post_type === 'repost' ? post.referenced_post! : post;
    const newLikeState = !originalPost.is_liked;
    const newCount = originalPost.likes_count + (newLikeState ? 1 : -1);

    this.ngZone.run(() => {
      // Update posts array
      this.posts.forEach(p => {
        if (p.id === originalPost.id) {
          p.is_liked = newLikeState;
          p.likes_count = newCount;
        }
        if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
          p.referenced_post.is_liked = newLikeState;
          p.referenced_post.likes_count = newCount;
        }
      });

      // Update replies array
      this.replies.forEach(p => {
        if (p.id === originalPost.id) {
          p.is_liked = newLikeState;
          p.likes_count = newCount;
        }
        if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
          p.referenced_post.is_liked = newLikeState;
          p.referenced_post.likes_count = newCount;
        }
      });

      // Update liked posts array
      this.likedPosts.forEach(p => {
        if (p.id === originalPost.id) {
          p.is_liked = newLikeState;
          p.likes_count = newCount;
        }
        if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
          p.referenced_post.is_liked = newLikeState;
          p.referenced_post.likes_count = newCount;
        }
      });

      // Update parent posts in reply chains (for replies tab)
      Object.values(this.replyParentChains).forEach(parentChain => {
        parentChain.forEach(parentPost => {
          if (parentPost.id === originalPost.id) {
            parentPost.is_liked = newLikeState;
            parentPost.likes_count = newCount;
          }
          if (parentPost.post_type === 'repost' && parentPost.referenced_post?.id === originalPost.id) {
            parentPost.referenced_post!.is_liked = newLikeState;
            parentPost.referenced_post!.likes_count = newCount;
          }
        });
      });

      // Force change detection on all post components to sync UI
      this.postComponents.forEach(postComponent => {
        if (postComponent.post.id === originalPost.id || 
            (postComponent.post.post_type === 'repost' && postComponent.post.referenced_post?.id === originalPost.id)) {
          postComponent.forceUpdate();
        }
      });

      this.cd.markForCheck();
    });

    // Backend call
    this.postService.likePost(originalPost.author.handle, originalPost.id).subscribe({
      error: (error) => {
        this.ngZone.run(() => {
          // Revert changes on error
          this.posts.forEach(p => {
            if (p.id === originalPost.id) {
              p.is_liked = !newLikeState;
              p.likes_count = originalPost.likes_count;
            }
            if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
              p.referenced_post.is_liked = !newLikeState;
              p.referenced_post.likes_count = originalPost.likes_count;
            }
          });

          this.replies.forEach(p => {
            if (p.id === originalPost.id) {
              p.is_liked = !newLikeState;
              p.likes_count = originalPost.likes_count;
            }
            if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
              p.referenced_post.is_liked = !newLikeState;
              p.referenced_post.likes_count = originalPost.likes_count;
            }
          });

          this.likedPosts.forEach(p => {
            if (p.id === originalPost.id) {
              p.is_liked = !newLikeState;
              p.likes_count = originalPost.likes_count;
            }
            if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
              p.referenced_post.is_liked = !newLikeState;
              p.referenced_post.likes_count = originalPost.likes_count;
            }
          });

          // Revert parent posts in reply chains (for replies tab)
          Object.values(this.replyParentChains).forEach(parentChain => {
            parentChain.forEach(parentPost => {
              if (parentPost.id === originalPost.id) {
                parentPost.is_liked = !newLikeState;
                parentPost.likes_count = originalPost.likes_count;
              }
              if (parentPost.post_type === 'repost' && parentPost.referenced_post?.id === originalPost.id) {
                parentPost.referenced_post!.is_liked = !newLikeState;
                parentPost.referenced_post!.likes_count = originalPost.likes_count;
              }
            });
          });

          // Force change detection on all post components to sync UI (revert)
          this.postComponents.forEach(postComponent => {
            if (postComponent.post.id === originalPost.id || 
                (postComponent.post.post_type === 'repost' && postComponent.post.referenced_post?.id === originalPost.id)) {
              postComponent.forceUpdate();
            }
          });

          this.cd.markForCheck();
        });
        console.error('Error liking post:', error);
        this.toastService.showError('Failed to update like');
      }
    });
  }

  onRepost(post: Post): void {
    const originalPost = post.post_type === 'repost' ? post.referenced_post! : post;
    const newRepostState = !originalPost.is_reposted;
    const newCount = originalPost.reposts_count + (newRepostState ? 1 : -1);

    this.ngZone.run(() => {
      // Update posts array
      this.posts.forEach(p => {
        if (p.id === originalPost.id) {
          p.is_reposted = newRepostState;
          p.reposts_count = newCount;
        }
        if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
          p.referenced_post.is_reposted = newRepostState;
          p.referenced_post.reposts_count = newCount;
        }
      });

      // Update replies array
      this.replies.forEach(p => {
        if (p.id === originalPost.id) {
          p.is_reposted = newRepostState;
          p.reposts_count = newCount;
        }
        if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
          p.referenced_post.is_reposted = newRepostState;
          p.referenced_post.reposts_count = newCount;
        }
      });

      // Update liked posts array
      this.likedPosts.forEach(p => {
        if (p.id === originalPost.id) {
          p.is_reposted = newRepostState;
          p.reposts_count = newCount;
        }
        if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
          p.referenced_post.is_reposted = newRepostState;
          p.referenced_post.reposts_count = newCount;
        }
      });

      // Update parent posts in reply chains (for replies tab)
      Object.values(this.replyParentChains).forEach(parentChain => {
        parentChain.forEach(parentPost => {
          if (parentPost.id === originalPost.id) {
            parentPost.is_reposted = newRepostState;
            parentPost.reposts_count = newCount;
          }
          if (parentPost.post_type === 'repost' && parentPost.referenced_post?.id === originalPost.id) {
            parentPost.referenced_post!.is_reposted = newRepostState;
            parentPost.referenced_post!.reposts_count = newCount;
          }
        });
      });

      // Force change detection on all post components to sync UI
      this.postComponents.forEach(postComponent => {
        if (postComponent.post.id === originalPost.id || 
            (postComponent.post.post_type === 'repost' && postComponent.post.referenced_post?.id === originalPost.id)) {
          postComponent.forceUpdate();
        }
      });

      this.cd.markForCheck();
    });

    // Backend call
    this.postService.repostPost(originalPost.author.handle, originalPost.id.toString()).subscribe({
      error: (error) => {
        this.ngZone.run(() => {
          // Revert changes on error
          this.posts.forEach(p => {
            if (p.id === originalPost.id) {
              p.is_reposted = !newRepostState;
              p.reposts_count = originalPost.reposts_count;
            }
            if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
              p.referenced_post.is_reposted = !newRepostState;
              p.referenced_post.reposts_count = originalPost.reposts_count;
            }
          });

          this.replies.forEach(p => {
            if (p.id === originalPost.id) {
              p.is_reposted = !newRepostState;
              p.reposts_count = originalPost.reposts_count;
            }
            if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
              p.referenced_post.is_reposted = !newRepostState;
              p.referenced_post.reposts_count = originalPost.reposts_count;
            }
          });

          this.likedPosts.forEach(p => {
            if (p.id === originalPost.id) {
              p.is_reposted = !newRepostState;
              p.reposts_count = originalPost.reposts_count;
            }
            if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
              p.referenced_post.is_reposted = !newRepostState;
              p.referenced_post.reposts_count = originalPost.reposts_count;
            }
          });

          // Revert parent posts in reply chains (for replies tab)
          Object.values(this.replyParentChains).forEach(parentChain => {
            parentChain.forEach(parentPost => {
              if (parentPost.id === originalPost.id) {
                parentPost.is_reposted = !newRepostState;
                parentPost.reposts_count = originalPost.reposts_count;
              }
              if (parentPost.post_type === 'repost' && parentPost.referenced_post?.id === originalPost.id) {
                parentPost.referenced_post!.is_reposted = !newRepostState;
                parentPost.referenced_post!.reposts_count = originalPost.reposts_count;
              }
            });
          });

          // Force change detection on all post components to sync UI (revert)
          this.postComponents.forEach(postComponent => {
            if (postComponent.post.id === originalPost.id || 
                (postComponent.post.post_type === 'repost' && postComponent.post.referenced_post?.id === originalPost.id)) {
              postComponent.forceUpdate();
            }
          });

          this.cd.markForCheck();
        });
        console.error('Error reposting:', error);
        this.toastService.showError('Failed to repost');
      }
    });
  }

  onBookmark(post: Post): void {
    const originalPost = post.post_type === 'repost' ? post.referenced_post! : post;
    const newBookmarkState = !originalPost.is_bookmarked;

    this.ngZone.run(() => {
      // Update posts array
      this.posts.forEach(p => {
        if (p.id === originalPost.id) {
          p.is_bookmarked = newBookmarkState;
        }
        if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
          p.referenced_post.is_bookmarked = newBookmarkState;
        }
      });

      // Update replies array
      this.replies.forEach(p => {
        if (p.id === originalPost.id) {
          p.is_bookmarked = newBookmarkState;
        }
        if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
          p.referenced_post.is_bookmarked = newBookmarkState;
        }
      });

      // Update liked posts array
      this.likedPosts.forEach(p => {
        if (p.id === originalPost.id) {
          p.is_bookmarked = newBookmarkState;
        }
        if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
          p.referenced_post.is_bookmarked = newBookmarkState;
        }
      });

      // Update parent posts in reply chains (for replies tab)
      Object.values(this.replyParentChains).forEach(parentChain => {
        parentChain.forEach(parentPost => {
          if (parentPost.id === originalPost.id) {
            parentPost.is_bookmarked = newBookmarkState;
          }
          if (parentPost.post_type === 'repost' && parentPost.referenced_post?.id === originalPost.id) {
            parentPost.referenced_post!.is_bookmarked = newBookmarkState;
          }
        });
      });

      // Force change detection on all post components to sync UI
      this.postComponents.forEach(postComponent => {
        if (postComponent.post.id === originalPost.id || 
            (postComponent.post.post_type === 'repost' && postComponent.post.referenced_post?.id === originalPost.id)) {
          postComponent.forceUpdate();
        }
      });

      this.cd.markForCheck();
    });

    // Backend call
    this.postService.bookmarkPost(originalPost.author.handle, originalPost.id).subscribe({
      error: (error) => {
        this.ngZone.run(() => {
          // Revert changes on error
          this.posts.forEach(p => {
            if (p.id === originalPost.id) {
              p.is_bookmarked = !newBookmarkState;
            }
            if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
              p.referenced_post.is_bookmarked = !newBookmarkState;
            }
          });

          this.replies.forEach(p => {
            if (p.id === originalPost.id) {
              p.is_bookmarked = !newBookmarkState;
            }
            if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
              p.referenced_post.is_bookmarked = !newBookmarkState;
            }
          });

          this.likedPosts.forEach(p => {
            if (p.id === originalPost.id) {
              p.is_bookmarked = !newBookmarkState;
            }
            if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
              p.referenced_post.is_bookmarked = !newBookmarkState;
            }
          });

          // Revert parent posts in reply chains (for replies tab)
          Object.values(this.replyParentChains).forEach(parentChain => {
            parentChain.forEach(parentPost => {
              if (parentPost.id === originalPost.id) {
                parentPost.is_bookmarked = !newBookmarkState;
              }
              if (parentPost.post_type === 'repost' && parentPost.referenced_post?.id === originalPost.id) {
                parentPost.referenced_post!.is_bookmarked = !newBookmarkState;
              }
            });
          });

          // Force change detection on all post components to sync UI (revert)
          this.postComponents.forEach(postComponent => {
            if (postComponent.post.id === originalPost.id || 
                (postComponent.post.post_type === 'repost' && postComponent.post.referenced_post?.id === originalPost.id)) {
              postComponent.forceUpdate();
            }
          });

          this.cd.markForCheck();
        });
        console.error('Error bookmarking post:', error);
        this.toastService.showError('Failed to update bookmark');
      }
    });
  }

  @HostListener('window:scroll', ['$event'])
  onWindowScroll(): void {
    // Only trigger pagination for posts and replies tabs
    if (this.activeTab !== 'posts' && this.activeTab !== 'replies') return;

    // Throttle scroll events
    if (this.scrollThrottleTimeout) return;

    this.scrollThrottleTimeout = setTimeout(() => {
      const scrollPosition = window.innerHeight + window.scrollY;
      const scrollThreshold = document.documentElement.scrollHeight * 0.8;

      if (this.activeTab === 'posts') {
        if (scrollPosition >= scrollThreshold && !this.isLoadingMorePosts && this.postService.hasMoreUserPosts) {
          this.ngZone.run(() => {
            this.loadMorePosts();
          });
        }
      } else if (this.activeTab === 'replies') {
        if (scrollPosition >= scrollThreshold && !this.isLoadingMoreReplies && this.postService.hasMoreUserReplies) {
          this.ngZone.run(() => {
            this.loadMoreReplies();
          });
        }
      }

      this.scrollThrottleTimeout = null;
    }, 200);
  }

  loadMorePosts(): void {
    if (!this.isLoadingMorePosts && this.postService.hasMoreUserPosts) {
      this.isLoadingMorePosts = true;
      this.cd.markForCheck();
      this.postService.loadMoreUserPosts();
    }
  }

  loadMoreReplies(): void {
    if (!this.isLoadingMoreReplies && this.postService.hasMoreUserReplies) {
      this.isLoadingMoreReplies = true;
      this.cd.markForCheck();
      this.postService.loadMoreUserReplies();
    }
  }

  /**
   * Initialize Hammer.js for swipe gestures
   */
  private initializeGestureSupport(): void {
    try {
      if (!this.isMobile) {
        return;
      }

      // Get the main container element (like home component does)
      const container = document.querySelector('.profile-container') as HTMLElement;
      
      if (!container) {
        return;
      }
      
      // Initialize Hammer.js on the profile container (like search component does)
      this.hammerManager = new Hammer(container);
      
      // Configure swipe gestures for horizontal swipes only (like search component)
      const swipeRecognizer = this.hammerManager.get('swipe');
      if (swipeRecognizer) {
        // Only detect horizontal swipes, not vertical ones - this allows normal scrolling
        swipeRecognizer.set({ direction: Hammer.DIRECTION_HORIZONTAL });
      }
      
      // Handle swipe left - switch to next tab (like search component)
      this.hammerManager.on('swipeleft', (event) => {
        this.handleSwipeLeft();
      });
      
      // Handle swipe right - switch to previous tab or open sidebar (like search component)
      this.hammerManager.on('swiperight', (event) => {
        this.handleSwipeRight();
      });
      
      // Setup pull-to-refresh
      this.setupPullToRefresh();
      
    } catch (error) {
      console.error('🔄 Profile: Error initializing Hammer.js:', error);
    }
  }

  /**
   * Handle left swipe - switch to next tab
   */
  private handleSwipeLeft(): void {
    switch (this.activeTab) {
      case 'posts':
        setTimeout(() => this.setActiveTab('replies'), 50);
        break;
      case 'replies':
        setTimeout(() => this.setActiveTab('media'), 50);
        break;
      case 'media':
        setTimeout(() => this.setActiveTab('human-art'), 50);
        break;
      case 'human-art':
        setTimeout(() => this.setActiveTab('likes'), 50);
        break;
      case 'likes':
        // Already on rightmost tab (likes), swipe left ignored
        break;
    }
  }

  /**
   * Handle right swipe - switch to previous tab or open sidebar
   */
  private handleSwipeRight(): void {
    switch (this.activeTab) {
      case 'posts':
        // On leftmost tab, swipe right opens sidebar
        this.sidebarService.openSidebar();
        break;
      case 'replies':
        setTimeout(() => this.setActiveTab('posts'), 50);
        break;
      case 'media':
        setTimeout(() => this.setActiveTab('replies'), 50);
        break;
      case 'human-art':
        setTimeout(() => this.setActiveTab('media'), 50);
        break;
      case 'likes':
        setTimeout(() => this.setActiveTab('human-art'), 50);
        break;
    }
  }

  /**
   * Pull to refresh functionality
   */
  private pullToRefresh(): void {
    if (this.isRefreshing) {
      return; // Prevent multiple refreshes
    }

    this.isRefreshing = true;
    
    // Reset all loading flags to prevent duplicate loading states
    this.isLoadingMedia = false;
    this.isLoadingHumanArt = false;
    this.isLoadingLikes = false;
    
    this.cd.markForCheck();

    // Refresh the current tab content without setting loading flags
    if (this.user?.handle) {
      this.loadTabContent(this.user.handle);
    }
  }

  /**
   * Setup pull-to-refresh using touch events instead of Hammer.js
   */
  private setupPullToRefresh(): void {
    let startY = 0;
    let currentY = 0;
    const threshold = 100; // Minimum distance to trigger refresh
    
    // Store references to handlers so we can remove them later
    this.handleTouchStart = (e: Event) => {
      const touchEvent = e as TouchEvent;
      // Only detect at the very top of the page
      if (window.scrollY === 0) {
        startY = touchEvent.touches[0].clientY;
      }
    };
    
    this.handleTouchMove = (e: Event) => {
      const touchEvent = e as TouchEvent;
      // Only process if we started at the top
      if (startY > 0) {
        currentY = touchEvent.touches[0].clientY;
        const deltaY = currentY - startY;
        
        // If pulling down more than threshold, trigger refresh
        if (deltaY > threshold && !this.isRefreshing) {
          this.pullToRefresh();
          startY = 0; // Reset to prevent multiple triggers
        }
      }
    };
    
    this.handleTouchEnd = () => {
      startY = 0; // Reset
    };
    
    // Add touch event listeners to the document body for full coverage
    document.body.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    document.body.addEventListener('touchmove', this.handleTouchMove, { passive: true });
    document.body.addEventListener('touchend', this.handleTouchEnd, { passive: true });
  }
} 