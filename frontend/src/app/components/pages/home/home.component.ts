import { Component, OnInit, ViewChild, ElementRef, HostListener, CUSTOM_ELEMENTS_SCHEMA, NgModule, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, NgZone, ViewChildren, QueryList } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Post } from '../../../models/post.model';
import { PostService } from '../../../services/post.service';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environment';
import { PostComponent } from '../../features/posts/post/post.component';
import { Router, ActivatedRoute } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { PostInputBoxComponent } from '../../features/posts/post-input-box/post-input-box.component';
import { PostUpdateService } from '../../../services/post-update.service';
import { Subscription } from 'rxjs';
import { CommentDialogComponent } from '../../features/comments/comment-dialog/comment-dialog.component';
import { ToastService } from '../../../services/toast.service';
import { GlobalModalService } from '../../../services/global-modal.service';
import { HomeRefreshService } from '../../../services/home-refresh.service';
import { FloatingNewPostsIndicatorComponent } from '../../shared/floating-new-posts-indicator/floating-new-posts-indicator.component';
import { FloatingCreatePostButtonComponent } from '../../shared/floating-create-post-button/floating-create-post-button.component';
import { SidebarService } from '../../../services/sidebar.service';

// Hammer.js imports
import Hammer from 'hammerjs';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule, 
    PostComponent,
    MatDialogModule,
    FormsModule,
    PostInputBoxComponent,
    FloatingNewPostsIndicatorComponent,
    FloatingCreatePostButtonComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit, OnDestroy {
  @ViewChildren(PostComponent) postComponents!: QueryList<PostComponent>;
  posts: Post[] = [];
  isInitialLoading = true;
  isLoadingMore = false;
  error: string | null = null;
  protected environment = environment;
  activeTab: 'for-you' | 'human-drawing' = 'for-you';
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  // New posts check properties
  hasNewPosts = false;
  newPostsCount = 0;
  newPostsAuthors: Array<{ avatar?: string, username: string }> = [];
  private newPostsCheckInterval: any;
  private latestPostIds: { [key: string]: number | null } = {
    'for-you': null,
    'human-drawing': null
  };

  // Scroll-based hiding properties
  isTabHidden = false;
  private lastScrollTop = 0;
  private scrollThreshold = 50; // Minimum scroll distance to trigger hide/show
  
  // Mobile detection - make it a getter for real-time detection
  get isMobile(): boolean {
    return window.innerWidth < 500;
  }

  // Properties for post creation
  isSubmitting = false;
  private subscriptions = new Subscription();
  private scrollThrottleTimeout: any;

  // Swipe gesture properties
  private hammerManager?: HammerManager;
  isRefreshing = false; // For pull-to-refresh only

  // Touch event handler properties for cleanup
  private handleTouchStart!: (e: Event) => void;
  private handleTouchMove!: (e: Event) => void;
  private handleTouchEnd!: () => void;


  constructor(
    private postService: PostService,
    public authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private cd: ChangeDetectorRef,
    private postUpdateService: PostUpdateService,
    private toastService: ToastService,
    private ngZone: NgZone,
    private globalModalService: GlobalModalService,
    private homeRefreshService: HomeRefreshService,
    private sidebarService: SidebarService
  ) {
    // Subscribe to posts$ stream for initial load and pagination
    this.subscriptions.add(
      this.postService.posts$.subscribe({
        next: (posts: Post[]) => {
          if (!posts) {
            this.posts = [];
          } else {
            // Always replace posts array to ensure change detection
            this.posts = [...posts];
          }
          
          // Update latest post ID for new posts check
          this.updateLatestPostId();
          
          // Only stop loading if we're not in initial loading state
          // This prevents the subscription from immediately hiding the loading state
          if (this.isInitialLoading) {
            this.isInitialLoading = false;
            
            // Initialize swipe gestures after posts are loaded and container exists (only once)
            console.log('🏠 Home: Posts loaded, now initializing swipe gestures...');
            setTimeout(() => {
              this.initializeSwipeGestures();
            }, 100); // Small delay to ensure DOM is fully rendered
          }
          
          // Clear refreshing state if this was a pull-to-refresh
          if (this.isRefreshing) {
            console.log('🔄 Home: Pull-to-refresh completed, clearing refresh state');
            this.isRefreshing = false;
            this.cd.markForCheck();
          }
          
          this.isLoadingMore = false;
          this.cd.markForCheck();
        },
        error: (error: Error) => {
          this.error = 'Failed to load posts. Please try again.';
          this.posts = [];
          
          // Stop loading immediately on error
          this.isInitialLoading = false;
          this.isLoadingMore = false;
          
          // Clear refreshing state on error
          if (this.isRefreshing) {
            this.isRefreshing = false;
          }
          
          this.cd.markForCheck();
        }
      })
    );

    // Subscribe to post updates for real-time interactions
    this.subscriptions.add(
      this.postUpdateService.postUpdate$.subscribe(({ postId, updatedPost }) => {
        // Find all instances of the post (original and reposts)
        this.posts = this.posts.map(post => {
          if (post.id === postId) {
            // Update the post while preserving its position in the array
            return { ...post, ...updatedPost };
          }
          // Also update any referenced posts (for reposts)
          if (post.post_type === 'repost' && post.referenced_post?.id === postId) {
            return {
              ...post,
              referenced_post: { ...post.referenced_post, ...updatedPost }
            };
          }
          return post;
        });
        this.cd.markForCheck();
      })
    );
  }

  @HostListener('window:scroll', ['$event'])
  onScroll(): void {
    // Run scroll handling outside Angular zone for better performance
    this.ngZone.runOutsideAngular(() => {
      if (this.scrollThrottleTimeout) {
        return;
      }

      this.scrollThrottleTimeout = setTimeout(() => {
        const scrollTop = document.documentElement.scrollTop;
        const scrollDelta = scrollTop - this.lastScrollTop;
        
        // Handle tab hiding/showing - synchronized with mobile header
        if (Math.abs(scrollDelta) > this.scrollThreshold) {
          if (scrollDelta > 0 && scrollTop > 50) {
            // Scrolling down - hide tab (same threshold as header)
            this.isTabHidden = true;
          } else if (scrollDelta < 0) {
            // Scrolling up - show tab
            this.isTabHidden = false;
          }
          this.lastScrollTop = scrollTop;
          
          // Run change detection inside Angular zone
          this.ngZone.run(() => {
            this.cd.markForCheck();
          });
        }
        
        const scrollPosition = window.innerHeight + window.scrollY;
        const scrollThreshold = document.documentElement.scrollHeight * 0.8;

        if (scrollPosition >= scrollThreshold && !this.isLoadingMore && this.postService.hasMorePosts) {
          // Run loadMorePosts inside Angular zone
          this.ngZone.run(() => {
            this.loadMorePosts();
          });
        }
        this.scrollThrottleTimeout = null;
      }, 200); // Increased throttle time to reduce sensitivity
    });
  }

  loadMorePosts(): void {
    if (!this.isLoadingMore && this.postService.hasMorePosts) {
      this.isLoadingMore = true;
      this.cd.markForCheck();
      this.postService.loadMorePosts();
    }
  }

  loadPosts(refresh: boolean = false): void {
    this.error = null;
    
    // Always show loading state when loading posts
    if (refresh) {
      this.isInitialLoading = true;
    }
    
    // Clear refreshing state if this was a pull-to-refresh
    if (this.isRefreshing) {
      this.isRefreshing = false;
      this.cd.markForCheck();
    }
    
    // Just trigger the load - we're already subscribed to posts$ for updates
    this.postService.loadPosts(true, this.activeTab);
  }

  ngOnInit(): void {
    console.log('🏠 Home: ngOnInit called');
    
    // Get initial tab state from URL params or localStorage
    const tabFromParams = this.route.snapshot.queryParams['tab'];
    const savedTab = localStorage.getItem('activeTab');
    this.activeTab = (tabFromParams || savedTab || 'for-you') as 'for-you' | 'human-drawing';
    localStorage.setItem('activeTab', this.activeTab);
    
    // Initial load of posts
    this.loadPosts(true);
    
    // Subscribe to future tab changes
    this.subscriptions.add(
      this.route.queryParams.subscribe(params => {
        const newTab = params['tab'] || 'for-you';
        if (this.activeTab !== newTab) {
          this.activeTab = newTab as 'for-you' | 'human-drawing';
          localStorage.setItem('activeTab', this.activeTab);
          this.loadPosts(true);
        }
      })
    );

    // Subscribe to home refresh service to refresh posts when sidebar/home button is clicked
    this.subscriptions.add(
      this.homeRefreshService.refreshHome$.subscribe(() => {
        this.refreshHomePosts();
      })
    );

    // Start checking for new posts after initial load
    setTimeout(() => {
      this.startNewPostsCheck();
    }, 5000); // Start after 5 seconds to avoid immediate check

    // Don't initialize swipe gestures here - wait for posts to load
    console.log('🏠 Home: Skipping swipe gesture initialization in ngOnInit (posts not loaded yet)');
  }

  onPostUpdated(updatedPost: Post): void {
    this.ngZone.run(() => {
      // Find all instances of the post (original and reposts) and update them
      this.posts = this.posts.map(post => {
        if (post.id === updatedPost.id) {
          // Update the exact post that was updated
          return { ...post, replies_count: updatedPost.replies_count };
        }
        // Also update any referenced posts (for reposts) - but only replies_count
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

  onLike(post: Post): void {
    const originalPost = post.post_type === 'repost' ? post.referenced_post! : post;
    const newLikeState = !originalPost.is_liked;
    const newCount = originalPost.likes_count + (newLikeState ? 1 : -1);

    this.ngZone.run(() => {
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

      // Force change detection on all post components
      this.postComponents.forEach(postComponent => {
        if (postComponent.post.id === originalPost.id || 
            (postComponent.post.post_type === 'repost' && postComponent.post.referenced_post?.id === originalPost.id)) {
          postComponent.forceUpdate();
        }
      });
    });

    // Backend call
    this.postService.likePost(originalPost.author.handle, originalPost.id).subscribe({
      error: (error) => {
        this.ngZone.run(() => {
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
          
          this.postComponents.forEach(postComponent => {
            if (postComponent.post.id === originalPost.id || 
                (postComponent.post.post_type === 'repost' && postComponent.post.referenced_post?.id === originalPost.id)) {
              postComponent.forceUpdate();
            }
          });
        });
        console.error('Error liking post:', error);
        this.toastService.showError('Failed to update like');
      }
    });
  }

  onComment(post: Post): void {
    const dialogRef = this.dialog.open(CommentDialogComponent, {
      panelClass: ['comment-dialog', 'dialog-position-top'],
      data: { post }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Comment was added, refresh the post
        const handle = post.author.handle;
        this.postService.getPost(handle, post.id).subscribe({
          next: (updatedPost) => {
            const index = this.posts.findIndex(p => p.id === post.id);
            if (index !== -1) {
              this.posts[index] = updatedPost;
            }
          },
          error: (error: Error) => console.error('Error refreshing post:', error)
        });
      }
    });
  }

  onRepost(post: Post): void {
    const originalPost = post.post_type === 'repost' ? post.referenced_post! : post;
    const newRepostState = !originalPost.is_reposted;
    const newCount = originalPost.reposts_count + (newRepostState ? 1 : -1);

    this.ngZone.run(() => {
      let updatedPosts = 0;
      this.posts.forEach(p => {
        if (p.id === originalPost.id) {
          p.is_reposted = newRepostState;
          p.reposts_count = newCount;
          updatedPosts++;
        }
        if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
          p.referenced_post.is_reposted = newRepostState;
          p.referenced_post.reposts_count = newCount;
          updatedPosts++;
        }
      });

      // Force change detection on all post components
      this.postComponents.forEach(postComponent => {
        if (postComponent.post.id === originalPost.id || 
            (postComponent.post.post_type === 'repost' && postComponent.post.referenced_post?.id === originalPost.id)) {
          postComponent.forceUpdate();
        }
      });
    });

    // Backend call
    this.postService.repostPost(originalPost.author.handle, originalPost.id.toString()).subscribe({
      error: (error) => {
        this.ngZone.run(() => {
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

          this.postComponents.forEach(postComponent => {
            if (postComponent.post.id === originalPost.id || 
                (postComponent.post.post_type === 'repost' && postComponent.post.referenced_post?.id === originalPost.id)) {
              postComponent.forceUpdate();
            }
          });
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
      this.posts.forEach(p => {
        if (p.id === originalPost.id) {
          p.is_bookmarked = newBookmarkState;
        }
        if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
          p.referenced_post.is_bookmarked = newBookmarkState;
        }
      });

      // Force change detection on all post components
      this.postComponents.forEach(postComponent => {
        if (postComponent.post.id === originalPost.id || 
            (postComponent.post.post_type === 'repost' && postComponent.post.referenced_post?.id === originalPost.id)) {
          postComponent.forceUpdate();
        }
      });
    });

    // Backend call
    this.postService.bookmarkPost(originalPost.author.handle, originalPost.id).subscribe({
      error: (error) => {
        this.ngZone.run(() => {
          this.posts.forEach(p => {
            if (p.id === originalPost.id) {
              p.is_bookmarked = !newBookmarkState;
            }
            if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
              p.referenced_post.is_bookmarked = !newBookmarkState;
            }
          });

          this.postComponents.forEach(postComponent => {
            if (postComponent.post.id === originalPost.id || 
                (postComponent.post.post_type === 'repost' && postComponent.post.referenced_post?.id === originalPost.id)) {
              postComponent.forceUpdate();
            }
          });
        });
        console.error('Error bookmarking post:', error);
        this.toastService.showError('Failed to update bookmark');
      }
    });
  }

  onShare(post: Post): void {
    const url = `${window.location.origin}/${post.author.handle}/post/${post.id}`;
    navigator.clipboard.writeText(url).then(() => {
      this.toastService.showSuccess('Post link copied to clipboard');
    }).catch(() => {
      this.toastService.showError('Failed to copy link to clipboard');
    });
  }

  onImageError(event: any): void {
    // Optionally set a fallback image
    event.target.src = 'assets/image-placeholder.png';
  }

  openPost(post: Post): void {
    // Clear any pending modal operations before navigation
    this.globalModalService.notifyComponentNavigation();
    
    // Navigate to the post detail view
    const handle = post.author.handle;
    this.router.navigate([`/${handle}/post`, post.id]);
  }

  protected onImageSelected(event: any): void {
    const file = event instanceof File ? event : event.target?.files?.[0];
    if (!file) return;

    this.postService.createPost('', [file]).subscribe({
      error: (error) => {
        console.error('Error creating post:', error);
      }
    });
  }

  protected onPostSubmit(data: { content: string, images?: File[], scheduledTime?: Date }): void {
    this.isSubmitting = true;
    
    // The PostService.createPost method already handles both regular and scheduled posts
    this.postService.createPost(data.content, data.images, data.scheduledTime).subscribe({
      complete: () => {
        this.isSubmitting = false;
      }
    });
  }

  onPostDeleted(postId: number): void {
    this.posts = this.posts.filter(post => post.id !== postId);
  }

  onPostReported(postId: number): void {
    // Remove the reported post from the timeline immediately
    this.posts = this.posts.filter(post => post.id !== postId);
    this.cd.markForCheck();
  }

  setActiveTab(tab: 'for-you' | 'human-drawing'): void {
    if (this.activeTab !== tab) {
      // Clear any pending modal operations before tab switch
      this.globalModalService.notifyComponentNavigation();
      
      this.activeTab = tab;
      localStorage.setItem('activeTab', tab);
      
      // Clear new posts state when switching tabs
      this.hasNewPosts = false;
      this.newPostsCount = 0;
      this.newPostsAuthors = [];
      
      // Show loading state during tab switch
      this.isInitialLoading = true;
      this.cd.markForCheck();
      
      // Update URL without triggering the router subscription
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { tab: tab === 'for-you' ? null : tab },
        queryParamsHandling: 'merge',
        replaceUrl: true
      });

      // Reload posts for the new tab
      this.loadPosts(true);
    }
  }

  ngOnDestroy(): void {
    // Clear any pending modal operations when component is destroyed
    this.globalModalService.notifyComponentNavigation();
    
    // Clean up subscriptions
    this.subscriptions.unsubscribe();
    
    // Clean up scroll throttle timeout
    if (this.scrollThrottleTimeout) {
      clearTimeout(this.scrollThrottleTimeout);
    }
    
    // Clean up new posts check timer
    if (this.newPostsCheckInterval) {
      clearInterval(this.newPostsCheckInterval);
      this.newPostsCheckInterval = null;
    }
    
    // Clean up Hammer manager
    if (this.hammerManager) {
      this.hammerManager.destroy();
    }
    
    // Clean up touch event listeners
    const container = document.querySelector('.posts-container');
    if (container && this.handleTouchStart && this.handleTouchMove && this.handleTouchEnd) {
      container.removeEventListener('touchstart', this.handleTouchStart);
      container.removeEventListener('touchmove', this.handleTouchMove);
      container.removeEventListener('touchend', this.handleTouchEnd);
      console.log('🔄 Home: Touch event listeners cleaned up');
    }
  }

  /**
   * Initialize Hammer.js swipe gestures for mobile
   */
  private initializeSwipeGestures(): void {
    console.log('🔄 Home: Initializing swipe gestures...');
    console.log('🔄 Home: isMobile =', this.isMobile);
    console.log('🔄 Home: Hammer available =', typeof Hammer !== 'undefined');
    console.log('🔄 Home: Hammer object =', Hammer);
    
    // Only initialize on mobile devices
    if (!this.isMobile) {
      console.log('🔄 Home: Not mobile, skipping gesture initialization');
      return;
    }

    // Get the main container element
    const container = document.querySelector('.posts-container') as HTMLElement;
    console.log('🔄 Home: Container element =', container);
    
    if (!container) {
      console.log('🔄 Home: No container found, skipping gesture initialization');
      return;
    }

    try {
      // Create Hammer manager
      this.hammerManager = new Hammer(container);
      console.log('🔄 Home: Hammer manager created successfully');
      
      // Configure for horizontal swipes only (don't interfere with vertical scrolling)
      const swipeRecognizer = this.hammerManager.get('swipe');
      if (swipeRecognizer) {
        // Only detect horizontal swipes, not vertical ones
        swipeRecognizer.set({ direction: Hammer.DIRECTION_HORIZONTAL });
        console.log('🔄 Home: Horizontal swipe recognizer configured');
      } else {
        console.log('🔄 Home: No swipe recognizer found');
      }
      
      // Handle horizontal swipes for tab switching and sidebar
      this.hammerManager.on('swipeleft', (event) => {
        console.log('🔄 Home: Swipe left detected!', event);
        this.handleSwipeLeft();
      });
      
      this.hammerManager.on('swiperight', (event) => {
        console.log('🔄 Home: Swipe right detected!', event);
        this.handleSwipeRight();
      });
      
      // Remove vertical swipe detection - it was interfering with scrolling
      console.log('🔄 Home: Vertical swipe detection disabled to allow normal scrolling');
      
      // Instead, use a more specific approach for pull-to-refresh
      this.setupPullToRefresh();
      
      console.log('🔄 Home: All gesture handlers registered successfully');
    } catch (error) {
      console.error('🔄 Home: Error initializing Hammer.js:', error);
    }
  }

  /**
   * Handle left swipe - switch to next tab or close sidebar
   */
  private handleSwipeLeft(): void {
    console.log('🔄 Home: handleSwipeLeft called, activeTab =', this.activeTab);
    
    // First check if sidebar is open - if so, close it regardless of tab
    if (this.sidebarService.isSidebarOpen()) {
      console.log('🔄 Home: Sidebar is open, closing it via swipe left');
      this.sidebarService.closeSidebar();
      return;
    }
    
    if (this.activeTab === 'for-you') {
      // On leftmost tab (For You), swipe left should switch to Human Art (right tab)
      console.log('🔄 Home: Switching from for-you to human-drawing tab');
      this.setActiveTab('human-drawing');
    } else if (this.activeTab === 'human-drawing') {
      // On rightmost tab (Human Art), swipe left should switch to For You (left tab)
      console.log('🔄 Home: Switching from human-drawing to for-you tab');
      this.setActiveTab('for-you');
    }
  }

  /**
   * Handle right swipe - switch to previous tab or open sidebar
   */
  private handleSwipeRight(): void {
    console.log('🔄 Home: handleSwipeRight called, activeTab =', this.activeTab);
    
    if (this.activeTab === 'for-you') {
      // On leftmost tab (For You), swipe right opens sidebar
      console.log('🔄 Home: Opening sidebar via swipe right');
      this.sidebarService.openSidebar();
    } else if (this.activeTab === 'human-drawing') {
      // On rightmost tab (Human Art), swipe right should switch to For You (left tab)
      console.log('🔄 Home: Switching from human-drawing to for-you tab');
      this.setActiveTab('for-you');
    }
  }

  /**
   * Pull to refresh functionality
   */
  private pullToRefresh(): void {
    if (this.isRefreshing) {
      console.log('🔄 Home: Already refreshing, ignoring duplicate request');
      return; // Prevent multiple refreshes
    }

    console.log('🔄 Home: Pull to refresh started');
    this.isRefreshing = true;
    this.cd.markForCheck();

    // Refresh posts without hiding content
    this.postService.loadPosts(true, this.activeTab);
  }

  // New posts check methods
  private startNewPostsCheck(): void {
    // Clear any existing interval
    if (this.newPostsCheckInterval) {
      clearInterval(this.newPostsCheckInterval);
      this.newPostsCheckInterval = null; // Add this line
    }
    
    // Start checking every 20 seconds
    this.newPostsCheckInterval = setInterval(() => {
      this.checkForNewPosts();
    }, 20000); // 20 seconds
  }

  private checkForNewPosts(): void {
    const currentLatestPostId = this.latestPostIds[this.activeTab];
    if (!currentLatestPostId || this.posts.length === 0) {
      return;
    }

    // Don't check for new posts if we just refreshed
    if (this.isInitialLoading) {
      return;
    }

    // Call backend to check for new posts
    this.postService.checkNewPosts(currentLatestPostId, this.activeTab).subscribe({
      next: (response: any) => {
        if (response.has_new_posts) {
          this.hasNewPosts = true;
          this.newPostsCount = response.new_posts_count;
          
          // Get author information from the posts service
          // We'll get the most recent posts to show their authors
          const currentPosts = this.postService.getCurrentPosts();
          if (currentPosts && currentPosts.length > 0) {
            // Get unique authors from the most recent posts (up to 3)
            const recentAuthors = currentPosts
              .slice(0, Math.min(3, currentPosts.length))
              .map(post => ({
                username: post.author.username,
                avatar: post.author.profile_picture
              }))
              .filter((author, index, arr) => 
                arr.findIndex(a => a.username === author.username) === index
              )
              .slice(0, 3);
            
            this.newPostsAuthors = recentAuthors;
            console.log('🏠 Home: New posts detected, authors:', recentAuthors);
          } else {
            // Fallback if no posts available
            this.newPostsAuthors = [
              { username: 'New posts', avatar: undefined }
            ];
            console.log('🏠 Home: New posts detected, using fallback authors');
          }
          
          console.log('🏠 Home: Setting hasNewPosts to true, count:', response.new_posts_count);
          this.cd.markForCheck();
        }
      },
      error: (error) => {
        console.error('Error checking for new posts:', error);
      }
    });
  }

  showNewPosts(): void {
    // Hide the button immediately
    this.hasNewPosts = false;
    this.newPostsCount = 0;
    this.newPostsAuthors = [];
    this.cd.markForCheck();

    // Refresh only the posts, not the entire component
    this.loadPosts(true);
    
    // Wait for posts to load, then reset latest post ID and restart timer
    setTimeout(() => {
      // Reset latest post ID to current posts after refresh
      this.updateLatestPostId();
      // Restart the timer
      this.startNewPostsCheck();
    }, 2000); // Wait 2 seconds for posts to fully load
  }

  private updateLatestPostId(): void {
    if (this.posts.length > 0) {
      this.latestPostIds[this.activeTab] = this.posts[0].id; // First post is the latest for current tab
    }
  }

  /**
   * Refresh home posts and check for new posts
   * Called when sidebar/home button is clicked
   */
  private refreshHomePosts(): void {
    console.log('🏠 Home Component: refreshHomePosts called!');
    
    // This method is called when sidebar/mobile header detects new posts and refreshes
    // Since the posts have already been refreshed, we need to reset the new posts state
    
    // Reset the new posts state since posts are already refreshed
    this.hasNewPosts = false;
    this.newPostsCount = 0;
    this.newPostsAuthors = [];
    
    // Update the latest post ID to the current posts
    this.updateLatestPostId();
    
    // Force change detection to hide the "Show new posts" button
    this.cd.markForCheck();
    
    console.log('🏠 Home Component: New posts state reset, button hidden');
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
        console.log('🔄 Home: Touch start at top, startY =', startY);
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
          console.log('🔄 Home: Pull-to-refresh threshold reached, deltaY =', deltaY);
          this.pullToRefresh();
          startY = 0; // Reset to prevent multiple triggers
        }
      }
    };
    
    this.handleTouchEnd = () => {
      startY = 0; // Reset
    };
    
    // Add touch event listeners to the posts container
    const container = document.querySelector('.posts-container');
    if (container) {
      container.addEventListener('touchstart', this.handleTouchStart, { passive: true });
      container.addEventListener('touchmove', this.handleTouchMove, { passive: true });
      container.addEventListener('touchend', this.handleTouchEnd, { passive: true });
      console.log('🔄 Home: Pull-to-refresh touch events added');
    }
  }
} 