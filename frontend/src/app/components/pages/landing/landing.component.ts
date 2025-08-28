import { Component, OnInit, HostListener, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PostComponent } from '../../features/posts/post/post.component';
import { SearchBarComponent } from '../../widgets/search-bar/search-bar.component';
import { PostService } from '../../../services/post.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Post } from '../../../models/post.model';
import { AuthService } from '../../../services/auth.service';
import { MatDialog } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';

// Hammer.js imports
import Hammer from 'hammerjs';
import { LoginModalComponent } from '../../features/auth/login-modal/login-modal.component';
import { RegisterModalComponent } from '../../features/auth/register-modal/register-modal.component';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PostComponent,
    SearchBarComponent,
    MatDialogModule
  ],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent implements OnInit, OnDestroy {
  // Separate post arrays for each tab to enable caching
  forYouPosts: Post[] = [];
  humanArtPosts: Post[] = [];
  
  // Get current tab's posts
  get posts(): Post[] {
    return this.activeTab === 'for-you' ? this.forYouPosts : this.humanArtPosts;
  }
  
  activeTab: 'for-you' | 'human-drawing' = 'for-you';
  isDarkMode = false;
  isPWAMode = false;
  showLoginModal = false;
  showRegisterModal = false;
  
  // Scroll-based hiding properties
  isHeaderHidden = false;
  isTabHidden = false;
  private lastScrollTop = 0;
  private scrollThreshold = 50; // Minimum scroll distance to trigger hide/show
  
  // Mobile detection - make it a getter for real-time detection
  get isMobile(): boolean {
    return window.innerWidth < 500;
  }
  
  // Infinite scroll properties per tab
  forYouLoading = false;
  humanArtLoading = false;
  loadingMore = false;
  forYouHasMore = true;
  humanArtHasMore = true;
  forYouCurrentPage = 1;
  humanArtCurrentPage = 1;
  private pageSize = 20;
  
  // Get current tab's loading state
  get loading(): boolean {
    return this.activeTab === 'for-you' ? this.forYouLoading : this.humanArtLoading;
  }
  
  // Get current tab's hasMore state
  get hasMore(): boolean {
    return this.activeTab === 'for-you' ? this.forYouHasMore : this.humanArtHasMore;
  }
  
  // Get current tab's current page
  get currentPage(): number {
    return this.activeTab === 'for-you' ? this.forYouCurrentPage : this.humanArtCurrentPage;
  }
  
  isInitialLoading = true; // Track initial page load vs pull-to-refresh
  
  // Swipe gesture properties
  private hammerManager?: HammerManager;
  isRefreshing = false; // For pull-to-refresh only

  // Touch event handler properties for cleanup
  private handleTouchStart!: (e: Event) => void;
  private handleTouchMove!: (e: Event) => void;
  private handleTouchEnd!: () => void;
  private scrollThrottleTimeout: any;

  constructor(
    private postService: PostService,
    private router: Router,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private authService: AuthService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnDestroy(): void {
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
    }
    
    // Clean up scroll throttle timeout
    if (this.scrollThrottleTimeout) {
      clearTimeout(this.scrollThrottleTimeout);
    }
  }

  @HostListener('window:scroll', ['$event'])
  onScroll(event: Event): void {
    // Throttle scroll events to improve performance
    if (this.scrollThrottleTimeout) {
      clearTimeout(this.scrollThrottleTimeout);
    }
    
    this.scrollThrottleTimeout = setTimeout(() => {
      const scrollTop = document.documentElement.scrollTop;
      const scrollDelta = scrollTop - this.lastScrollTop;
      
      // Handle header and tab hiding/showing - synchronized timing
      if (Math.abs(scrollDelta) > this.scrollThreshold) {
        if (scrollDelta > 0 && scrollTop > 50) {
          // Scrolling down - hide headers (same threshold)
          this.isHeaderHidden = true;
          this.isTabHidden = true;
        } else if (scrollDelta < 0) {
          // Scrolling up - show headers
          this.isHeaderHidden = false;
          this.isTabHidden = false;
        }
        this.lastScrollTop = scrollTop;
      }
      
      // Check if user scrolled near bottom of page
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      
      // Trigger load more when user is 200px from bottom
      const threshold = 200;
      
      if (scrollTop + clientHeight >= scrollHeight - threshold && 
          this.hasMore && 
          !this.loading && 
          !this.loadingMore) {
        this.loadMore();
      }
    }, 100); // 100ms throttle
  }

  ngOnInit() {
    // Check if running as PWA
    this.isPWAMode = window.matchMedia('(display-mode: standalone)').matches;
    
    // Listen for PWA mode changes
    window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
      this.isPWAMode = e.matches;
    });

    // Check if user is authenticated
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/home']);
      return;
    }

    // Get initial tab state from URL params
    const tabFromParams = this.route.snapshot.queryParams['tab'];
    this.activeTab = (tabFromParams || 'for-you') as 'for-you' | 'human-drawing';
    
    // Initialize gestures immediately (don't wait for posts)
    setTimeout(() => {
      this.initializeGestureSupport();
    }, 100);
    
    // Initial load of posts for the active tab
    this.loadPostsForTab(this.activeTab);
    
    // Subscribe to future tab changes
    this.route.queryParams.subscribe(params => {
      const newTab = params['tab'] || 'for-you';
      if (this.activeTab !== newTab) {
        this.activeTab = newTab as 'for-you' | 'human-drawing';
        this.loadPosts();
      }
    });

    // Check dark mode
    this.checkDarkMode();
    const observer = new MutationObserver(() => {
      this.checkDarkMode();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
  }

  private checkDarkMode() {
    this.isDarkMode = document.documentElement.classList.contains('dark');
  }

  onTitleClick() {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/home']);
    }
  }

  setActiveTab(tab: 'for-you' | 'human-drawing'): void {
    if (this.activeTab !== tab) {
      this.activeTab = tab;
      
      // Check if the target tab already has cached content
      const targetTabHasContent = (tab === 'for-you' && this.forYouPosts.length > 0) || 
                                 (tab === 'human-drawing' && this.humanArtPosts.length > 0);
      
      if (targetTabHasContent) {
        // Tab has cached content - show instantly without loading
        this.isInitialLoading = false;
        this.cd.markForCheck();
      } else {
        // Tab has no cached content - show loading state
        this.isInitialLoading = true;
        this.cd.markForCheck();
      }
      
      // Update URL without navigation
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { tab: tab === 'for-you' ? null : tab },
        queryParamsHandling: 'merge',
        replaceUrl: true
      });

      // Only load posts if the target tab has no cached content
      if (!targetTabHasContent) {
        this.loadPostsForTab(tab);
      }
    }
  }

  /**
   * Load posts for a specific tab
   */
  private loadPostsForTab(tab: 'for-you' | 'human-drawing'): void {
    if (tab === 'for-you') {
      this.forYouLoading = true;
      this.forYouCurrentPage = 1;
      this.forYouHasMore = true;
    } else {
      this.humanArtLoading = true;
      this.humanArtCurrentPage = 1;
      this.humanArtHasMore = true;
    }
    
    this.postService.getPublicPosts(tab, 1).subscribe({
      next: response => {
        const posts = response.results || [];
        
        if (tab === 'for-you') {
          this.forYouPosts = posts;
          this.forYouHasMore = !!response.next;
          this.forYouLoading = false;
        } else {
          this.humanArtPosts = posts;
          this.humanArtHasMore = !!response.next;
          this.humanArtLoading = false;
        }
        
        // Set isInitialLoading to false after first successful load
        if (this.isInitialLoading) {
          this.isInitialLoading = false;
        }
        
        // Reset refreshing state after a delay to show the loading row briefly
        if (this.isRefreshing) {
          setTimeout(() => {
            this.isRefreshing = false;
            this.cd.markForCheck();
          }, 500);
        }
        
        // Fallback gesture initialization if not already initialized
        if (!this.hammerManager) {
          setTimeout(() => {
            this.initializeGestureSupport();
          }, 100);
        }
      },
      error: (error) => {
        console.error('Error loading public posts:', error);
        
        if (tab === 'for-you') {
          this.forYouLoading = false;
        } else {
          this.humanArtLoading = false;
        }
        
        // Reset refreshing state on error
        if (this.isRefreshing) {
          this.isRefreshing = false;
          this.cd.markForCheck();
        }
        
        // Initialize gestures even if posts fail to load
        if (!this.hammerManager) {
          setTimeout(() => {
            this.initializeGestureSupport();
          }, 100);
        }
      }
    });
  }

  private loadPosts() {
    // Use the tab-specific loading method for first page
    if (this.currentPage === 1) {
      this.loadPostsForTab(this.activeTab);
    } else {
      // Load more posts for pagination
      this.loadMorePostsForTab(this.activeTab);
    }
  }

  /**
   * Load more posts for pagination (infinite scroll)
   */
  private loadMorePostsForTab(tab: 'for-you' | 'human-drawing'): void {
    const currentPage = tab === 'for-you' ? this.forYouCurrentPage : this.humanArtCurrentPage;
    
    this.postService.getPublicPosts(tab, currentPage).subscribe({
      next: response => {
        const posts = response.results || [];
        
        if (tab === 'for-you') {
          // Append new posts to existing ones
          this.forYouPosts = [...this.forYouPosts, ...posts];
          this.forYouHasMore = !!response.next;
          this.forYouLoading = false;
        } else {
          // Append new posts to existing ones
          this.humanArtPosts = [...this.humanArtPosts, ...posts];
          this.humanArtHasMore = !!response.next;
          this.humanArtLoading = false;
        }
        
        this.loadingMore = false;
      },
      error: (error) => {
        console.error('Error loading more posts:', error);
        
        if (tab === 'for-you') {
          this.forYouLoading = false;
        } else {
          this.humanArtLoading = false;
        }
        
        this.loadingMore = false;
      }
    });
  }

  /**
   * Initialize gesture support for mobile
   */
  private initializeGestureSupport(): void {
    try {
      if (!this.isMobile) {
        return;
      }

      // Try to get the posts container, but fall back to body if it doesn't exist
      let container = document.querySelector('.posts-container') as HTMLElement;
      
      if (!container) {
        // Fallback: use the main content area if posts container doesn't exist
        container = document.querySelector('main') as HTMLElement;
      }
      
      if (!container) {
        // Final fallback: use body for gesture detection
        container = document.body as HTMLElement;
      }
      
      if (!container) {
        return;
      }
      
      // Initialize Hammer.js on the container
      this.hammerManager = new Hammer(container);
      
      // Configure swipe gestures for horizontal swipes only
      const swipeRecognizer = this.hammerManager.get('swipe');
      if (swipeRecognizer) {
        // Only detect horizontal swipes, not vertical ones - this allows normal scrolling
        swipeRecognizer.set({ direction: Hammer.DIRECTION_HORIZONTAL });
      }
      
      // Handle swipe left - switch to next tab
      this.hammerManager.on('swipeleft', (event) => {
        this.handleSwipeLeft();
      });
      
      // Handle swipe right - switch to previous tab
      this.hammerManager.on('swiperight', (event) => {
        this.handleSwipeRight();
      });
      
      // Setup pull-to-refresh
      this.setupPullToRefresh();
      
    } catch (error) {
      console.error('Error initializing Hammer.js:', error);
    }
  }

  /**
   * Handle left swipe - switch to next tab
   */
  private handleSwipeLeft(): void {
    if (this.activeTab === 'for-you') {
      // On leftmost tab (For You), swipe left should switch to Human Art (right tab)
      this.setActiveTab('human-drawing');
    } else if (this.activeTab === 'human-drawing') {
      // On rightmost tab (Human Art), swipe left should switch to For You (left tab)
      this.setActiveTab('for-you');
    }
  }

  /**
   * Handle right swipe - switch to previous tab
   */
  private handleSwipeRight(): void {
    if (this.activeTab === 'for-you') {
      // On leftmost tab (For You), swipe right should switch to Human Art (right tab)
      this.setActiveTab('human-drawing');
    } else if (this.activeTab === 'human-drawing') {
      // On rightmost tab (Human Art), swipe right should switch to For You (left tab)
      this.setActiveTab('for-you');
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
    this.cd.markForCheck();

    // Reset pagination and reload posts for current tab without clearing existing content
    if (this.activeTab === 'for-you') {
      this.forYouCurrentPage = 1;
      this.forYouHasMore = true;
    } else {
      this.humanArtCurrentPage = 1;
      this.humanArtHasMore = true;
    }
    this.loadPosts();
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
    
    // Try to add touch event listeners to the posts container, fallback to body
    let container = document.querySelector('.posts-container');
    if (!container) {
      container = document.querySelector('main');
    }
    if (!container) {
      container = document.body;
    }
    
    if (container) {
      container.addEventListener('touchstart', this.handleTouchStart, { passive: true });
      container.addEventListener('touchmove', this.handleTouchMove, { passive: true });
      container.addEventListener('touchend', this.handleTouchEnd, { passive: true });
    }
  }

  private loadMore() {
    if (this.loadingMore || !this.hasMore) return;
    
    this.loadingMore = true;
    
    // Increment the appropriate tab's current page
    if (this.activeTab === 'for-you') {
      this.forYouCurrentPage++;
    } else {
      this.humanArtCurrentPage++;
    }
    
    this.loadPosts();
  }

  openLoginModal() {
    const dialogRef = this.dialog.open(LoginModalComponent, {
      width: '400px',
      panelClass: ['custom-dialog-container', 'centered-dialog'],
      disableClose: false,
      autoFocus: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // If login was successful, navigate to home
        this.router.navigate(['/home']);
      }
    });
  }

  openRegisterModal() {
    const dialogRef = this.dialog.open(RegisterModalComponent, {
      width: '450px',
      panelClass: ['custom-dialog-container', 'centered-dialog'],
      disableClose: false,
      autoFocus: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // If registration was successful, navigate to home
        this.router.navigate(['/home']);
      }
    });
  }
} 