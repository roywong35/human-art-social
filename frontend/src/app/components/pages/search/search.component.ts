import { Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Post } from '../../../models/post.model';
import { User } from '../../../models/user.model';
import { PostService } from '../../../services/post.service';
import { UserService } from '../../../services/user.service';
import { OptimisticUpdateService } from '../../../services/optimistic-update.service';
import { AuthService } from '../../../services/auth.service';
import { PostComponent } from '../../features/posts/post/post.component';
import { SearchBarComponent } from '../../widgets/search-bar/search-bar.component';
import { GlobalModalService } from '../../../services/global-modal.service';
import { HashtagResult, HashtagService } from '../../../services/hashtag.service';
import { forkJoin, Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import Hammer from 'hammerjs';
import { SidebarService } from '../../../services/sidebar.service';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SearchBarComponent, PostComponent],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('searchBar') searchBar!: SearchBarComponent;
  @ViewChild('searchContainer', { static: false }) searchContainer!: ElementRef;
  
  searchQuery: string = '';
  posts: Post[] = [];
  users: User[] = [];
  isLoading: boolean = false;
  isRefreshing: boolean = false; // New state for pull-to-refresh
  isHashtagSearch: boolean = false;
  hasSearched: boolean = false;
  
  // Tab management
  activeTab: 'top' | 'people' | 'trending' = 'top';
  
  // Loading states for different sections
  isLoadingPosts: boolean = false;
  isLoadingUsers: boolean = false;

  // Pagination properties
  currentPostsPage: number = 1;
  currentUsersPage: number = 1;
  hasMorePosts: boolean = true;
  hasMoreUsers: boolean = true;
  isLoadingMorePosts: boolean = false;
  isLoadingMoreUsers: boolean = false;

  // Current user tracking
  currentUser: User | null = null;

  // Trending hashtags properties
  trendingTopics: HashtagResult[] = [];
  readonly maxTrendingTopics = 5;
  isLoadingTrending = false;

  // Recommended users properties
  recommendedUsers: User[] = [];
  readonly maxRecommendedUsers = 3;

  // User preview modal properties
  private hoverTimeout: any;
  private leaveTimeout: any;
  private lastHoveredElement: Element | null = null;

  // Subscriptions for cleanup
  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private postService: PostService,
    private userService: UserService,
    private hashtagService: HashtagService,
    private optimisticUpdateService: OptimisticUpdateService,
    private authService: AuthService,
    private globalModalService: GlobalModalService,
    private sidebarService: SidebarService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Get current user first
    const userSub = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
    this.subscriptions.push(userSub);

    // Subscribe to follow status changes for real-time sync
    this.setupFollowStatusSync();

    // Load trending hashtags and recommended users with caching
    this.loadTrending(false); // Use cache if available
    this.loadRecommendedUsers();

    // Subscribe to route parameter changes to handle navigation to search page
    const routeSub = this.route.queryParams.subscribe(params => {
      const query = params['q'];
      const tab = params['tab'];
      
      // Update search query if it changed
      if (query !== this.searchQuery) {
        this.searchQuery = query || '';
        if (query) {
          this.performSearch(query);
          // When searching, switch to 'top' tab to show results
          this.activeTab = 'top';
        } else {
          // Clear results if no query
          this.posts = [];
          this.users = [];
          this.hasSearched = false;
          this.isLoading = false;
          // When no search, switch to 'trending' tab
          this.activeTab = 'trending';
        }
      }
      
      // Update active tab if it changed (only for valid tabs)
      if (tab && ['top', 'latest', 'people', 'posts'].includes(tab)) {
        this.activeTab = tab as any;
      }
    });
    this.subscriptions.push(routeSub);
  }

  ngAfterViewInit() {
    if (this.searchContainer) {
      this.setupGestureSupport();
    }
  }

  private setupFollowStatusSync(): void {
    // Subscribe to follow status changes to update user lists in real-time
    const followSub = this.optimisticUpdateService.followStatusChanges.subscribe(change => {
      if (change && this.users.length > 0) {
        // Find and update the user in the list
        const userIndex = this.users.findIndex(user => user.handle === change.userHandle);
        if (userIndex !== -1) {
          this.users[userIndex].is_following = change.isFollowing;
          this.users[userIndex].followers_count = change.followersCount;
        }
      }
      
      // Also update recommended users list
      if (change && this.recommendedUsers.length > 0) {
        const userIndex = this.recommendedUsers.findIndex(user => user.handle === change.userHandle);
        if (userIndex !== -1) {
          this.recommendedUsers[userIndex].is_following = change.isFollowing;
          this.recommendedUsers[userIndex].followers_count = change.followersCount;
        }
      }
    });
    this.subscriptions.push(followSub);
  }

  private loadTrending(forceRefresh: boolean = false) {
    
    // Only set loading state if NOT refreshing and no cached content
    if (!this.isRefreshing && !this.hashtagService.hasCachedTrending()) {
      this.isLoadingTrending = true;
    }
    
    // Add cache-busting parameter if forcing refresh
    const params = forceRefresh ? { _t: Date.now() } : {};
    
    this.hashtagService.getTrendingHashtags(undefined, params).subscribe({
      next: (response) => {
        this.trendingTopics = response.results;
        
        // If we still don't have enough trending topics, add some default popular hashtags
        if (this.trendingTopics.length < 3) {
          const defaultTrending = [
            { name: 'art', post_count: 150 },
            { name: 'drawing', post_count: 120 },
            { name: 'creative', post_count: 95 },
            { name: 'design', post_count: 80 },
            { name: 'inspiration', post_count: 75 }
          ];
          
          // Add default trending topics that aren't already in the list
          const existingNames = new Set(this.trendingTopics.map(t => t.name));
          for (const defaultTopic of defaultTrending) {
            if (!existingNames.has(defaultTopic.name) && this.trendingTopics.length < this.maxTrendingTopics) {
              this.trendingTopics.push(defaultTopic);
            }
          }
        }
        this.isLoadingTrending = false;
        // Also clear the refresh state if this was called from pullToRefresh
        if (this.isRefreshing) {
          this.isRefreshing = false;
          this.cd.markForCheck(); // Trigger change detection
        }
      },
      error: (error) => {
        console.error('Error loading trending:', error);
        
        // On error, show default trending topics
        this.trendingTopics = [
          { name: 'art', post_count: 150 },
          { name: 'drawing', post_count: 120 },
          { name: 'creative', post_count: 95 },
          { name: 'design', post_count: 80 },
          { name: 'inspiration', post_count: 75 }
        ];
        this.isLoadingTrending = false;
        // Also clear the refresh state if this was called from pullToRefresh
        if (this.isRefreshing) {
          this.isRefreshing = false;
          this.cd.markForCheck(); // Trigger change detection
        }
      }
    });
  }

  private loadRecommendedUsers() {
    
    // Only set loading state if NOT refreshing and no cached content
    if (!this.isRefreshing && !this.userService.hasCachedRecommendedUsers()) {
      this.isLoadingUsers = true;
    }
    
    this.userService.getRecommendedUsersPaginated(1).subscribe({
      next: (response) => {
        this.recommendedUsers = response.results;
        this.isLoadingUsers = false;
        // Also clear the refresh state if this was called from pullToRefresh
        if (this.isRefreshing) {
          this.isRefreshing = false;
          this.cd.markForCheck(); // Trigger change detection
        }
      },
      error: (error) => {
        console.error('Error loading recommended users:', error);
        this.isLoadingUsers = false;
        // Also clear the refresh state if this was called from pullToRefresh
        if (this.isRefreshing) {
          this.isRefreshing = false;
          this.cd.markForCheck(); // Trigger change detection
        }
      }
    });
  }

  /**
   * Force refresh trending content (used for pull-to-refresh)
   */
  forceRefreshTrending(): void {
    this.loadTrending(true);
    this.loadRecommendedUsers(); // This will also refresh users
  }

  goBack() {
    // Clear search query and navigate back to search page without query params
    this.searchQuery = '';
    this.posts = [];
    this.users = [];
    this.hasSearched = false;
    this.isLoading = false;
    this.activeTab = 'trending';
    
    // Clear the search bar text
    if (this.searchBar) {
      this.searchBar.searchQuery = '';
    }
    
    // Update URL to remove search parameters
    this.router.navigate(['/search'], { queryParams: {} });
  }

  switchTab(tab: 'top' | 'people' | 'trending') {
    
    // Allow switching between top and people tabs when searching
    if (this.hasSearched && (tab === 'top' || tab === 'people')) {
      this.activeTab = tab;
      this.cd.markForCheck(); // Trigger change detection
    } else if (!this.hasSearched && tab === 'trending') {
      // Allow switching to trending tab when not searching
      this.activeTab = tab;
      this.cd.markForCheck(); // Trigger change detection
    }
  }

  trackByPostId(index: number, post: Post): number {
    return post.id;
  }

  trackByUserId(index: number, user: User): number {
    return user.id;
  }

  followUser(user: User, event: Event) {
    event.stopPropagation(); // Prevent navigation to profile
    
    // Let the service handle optimistic updates
    const request = user.is_following
      ? this.optimisticUpdateService.unfollowUserOptimistic(user)
      : this.optimisticUpdateService.followUserOptimistic(user);

    request.subscribe({
      next: (updatedUser) => {
        // The service will handle optimistic updates and notifications
      },
      error: (error) => {
        console.error('Error following/unfollowing user:', error);
      }
    });
  }

  navigateToProfile(user: User) {
    // Clear any pending modal operations before navigation
    this.globalModalService.notifyComponentNavigation();
    this.router.navigate(['/', user.handle]);
  }

  onFollowButtonHover(user: User, isHovering: boolean) {
    // Handle follow button hover effects if needed
    // This method is called from the template to match right-sidebar behavior
  }

  /**
   * Check if the follow button should be shown for a user
   * Hide the follow button if the current user is viewing their own profile
   */
  shouldShowFollowButton(user: User): boolean {
    return !!(this.currentUser && user.handle !== this.currentUser.handle);
  }

  // Get limited users for Top tab (max 3)
  get limitedUsers(): User[] {
    return this.users.slice(0, 3);
  }

  // Filter out reposted posts from search results
  get filteredPosts(): Post[] {
    return this.posts.filter(post => post.post_type !== 'repost');
  }

  // Smart loading logic: show content if we have results, hide if we don't
  get shouldShowContentDuringLoading(): boolean {
    // If we have search results, keep them visible during refresh
    if (this.hasSearched && (this.users.length > 0 || this.posts.length > 0)) {
      return true;
    }
    // If no results yet, hide content during loading
    return false;
  }

  // Simplified logic for showing loading row
  get shouldShowLoadingRow(): boolean {
    // Show loading row for:
    // 1. Pull-to-refresh (isRefreshing = true) - shows loading above content
    // 2. Initial search with no results yet (isLoading && hasSearched && no results)
    return this.isRefreshing || (this.isLoading && this.hasSearched && this.users.length === 0 && this.posts.length === 0);
  }

  // Logic for showing Trending/Who to follow sections
  get shouldShowTrendingSections(): boolean {
    // Show sections when:
    // 1. Initial loading is complete (isLoading = false)
    // 2. AND we have some data loaded (trending or users)
    // 3. OR when refreshing (keep content visible during refresh)
    const hasData = this.trendingTopics.length > 0 || this.recommendedUsers.length > 0;
    const result = (!this.isLoading && hasData) || this.isRefreshing;
    
    return result;
  }

  // Check if we should show individual loading states (only during initial load, not refresh)
  get shouldShowTrendingLoading(): boolean {
    return this.isLoadingTrending && !this.isRefreshing;
  }

  get shouldShowUsersLoading(): boolean {
    return this.isLoadingUsers && !this.isRefreshing;
  }

  navigateToHashtag(hashtag: string) {
    this.router.navigate(['/search'], { queryParams: { q: `#${hashtag}` } }).then(() => {
      this.scrollToTopAfterNavigation();
    });
  }

  formatCount(count: number): string {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    }
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count.toString();
  }

  private scrollToTopAfterNavigation(): void {
    // Use setTimeout to ensure navigation has completed
    setTimeout(() => {
      window.scrollTo({
        top: 0,
        behavior: 'auto'
      });
    }, 100);
  }

  private performSearch(query: string) {
    if (!query.trim()) {
      this.posts = [];
      this.users = [];
      this.isLoading = false;
      this.hasSearched = false;
      return;
    }

    this.isLoading = true;
    
    // Only clear results on initial search, not on refresh
    if (!this.isRefreshing) {
      this.posts = [];
      this.users = [];
      // Reset pagination for new search
      this.currentPostsPage = 1;
      this.currentUsersPage = 1;
      this.hasMorePosts = true;
      this.hasMoreUsers = true;
      this.isLoadingMorePosts = false;
      this.isLoadingMoreUsers = false;
    }
    
    this.hasSearched = true;

    // Determine search terms for different types
    const isHashtagSearch = query.startsWith('#');
    const isUserSearch = query.startsWith('@');
    
    // For hashtag searches, only search posts
    if (isHashtagSearch) {
      const hashtagTerm = query.substring(1);
      this.searchPosts(hashtagTerm);
    } else {
      // For regular searches, search both users and posts
      const userSearchTerm = isUserSearch ? query.substring(1) : query;
      const postSearchTerm = isUserSearch ? userSearchTerm : query;
      
      // Search both users and posts simultaneously
      // Only set loading states if NOT refreshing (prevents content from disappearing)
      if (!this.isRefreshing) {
        this.isLoadingUsers = true;
        this.isLoadingPosts = true;
      }
      
      forkJoin({
        users: this.userService.searchUsers(userSearchTerm, 1),
        posts: this.postService.searchPosts(postSearchTerm, 1, this.activeTab)
      }).subscribe({
        next: (results) => {
          this.users = results.users.results;
          // Filter out reposted posts from search results
          this.posts = results.posts.results.filter((post: Post) => post.post_type !== 'repost');
          
          // Update pagination state
          this.currentUsersPage = 1;
          this.currentPostsPage = 1;
          this.hasMoreUsers = !!results.users.next;
          this.hasMorePosts = !!results.posts.next;
          
          this.hasSearched = true;
          
          this.isLoading = false;
          this.isLoadingUsers = false;
          this.isLoadingPosts = false;
          
          // Also clear refresh state if this was a refresh operation
          if (this.isRefreshing) {
            this.isRefreshing = false;
            this.cd.markForCheck(); // Trigger change detection
          }
        },
        error: (error) => {
          console.error('Error searching:', error);
          this.users = [];
          this.posts = [];
          this.isLoading = false;
          this.isLoadingUsers = false;
          this.isLoadingPosts = false;
          this.hasSearched = true;
          // Also clear refresh state if this was a refresh operation
          if (this.isRefreshing) {
            this.isRefreshing = false;
            this.cd.markForCheck(); // Trigger change detection
          }
        }
      });
    }
  }

  private searchPosts(query: string) {
    // Only set loading state if NOT refreshing (prevents content from disappearing during refresh)
    if (!this.isRefreshing) {
      this.isLoadingPosts = true;
    }
    this.hasSearched = true;
    
    // Only clear results on initial search, not on refresh
    if (!this.isRefreshing) {
      this.posts = [];
      // Reset pagination for new search
      this.currentPostsPage = 1;
      this.hasMorePosts = true;
      this.isLoadingMorePosts = false;
    }
    
    this.postService.searchPosts(query, 1, this.activeTab).subscribe({
      next: (response) => {
        // Filter out reposted posts from search results
        this.posts = response.results.filter((post: Post) => post.post_type !== 'repost');
        
        // Update pagination state
        this.currentPostsPage = 1;
        this.hasMorePosts = !!response.next;
        
        this.hasSearched = true;
        this.isLoading = false;
        this.isLoadingPosts = false;
        // Also clear refresh state if this was a refresh operation
        if (this.isRefreshing) {
          this.isRefreshing = false;
          this.cd.markForCheck(); // Trigger change detection
        }
      },
      error: (error) => {
        console.error('Error searching posts:', error);
        this.posts = [];
        this.isLoading = false;
        this.isLoadingPosts = false;
        this.hasSearched = true;
        // Also clear refresh state if this was a refresh operation
        if (this.isRefreshing) {
          this.isRefreshing = false;
          this.cd.markForCheck(); // Trigger change detection
        }
      }
    });
  }

  onPostReported(postId: number): void {
    // Remove the reported post from search results
    this.posts = this.posts.filter(post => post.id !== postId);
  }

  // User preview modal methods
  protected onUserHover(event: MouseEvent, user: User): void {
    if (!user) return;
    
    // Clear any pending timeouts
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }
    if (this.leaveTimeout) {
      clearTimeout(this.leaveTimeout);
    }

    this.hoverTimeout = setTimeout(() => {
      // Store the hovered element for accurate positioning
      this.lastHoveredElement = event.target as Element;
      
      // X approach: Pre-fetch full user data before showing modal
      // This ensures counts and follow button state are ready immediately
      this.userService.getUserByHandle(user.handle).pipe(take(1)).subscribe({
        next: (fullUser) => {
          // Show modal with complete data - no more delayed counts!
          if (this.lastHoveredElement) {
            this.globalModalService.showUserPreviewAccurate(fullUser, this.lastHoveredElement, {
              clearLeaveTimeout: () => {
                if (this.leaveTimeout) {
                  clearTimeout(this.leaveTimeout);
                }
              }
            });
          }
        },
        error: () => {
          // Fallback: show lightweight preview if fetch fails
          if (this.lastHoveredElement) {
            this.globalModalService.showUserPreviewAccurate(user, this.lastHoveredElement, {
              clearLeaveTimeout: () => {
                if (this.leaveTimeout) {
                  clearTimeout(this.leaveTimeout);
                }
              }
            });
          }
        }
      });
    }, 200); // 200ms delay for X-like responsiveness
  }

  protected onUserHoverLeave(): void {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }
    
    // Longer delay to allow moving to the modal
    this.leaveTimeout = setTimeout(() => {
      this.globalModalService.hideUserPreview();
    }, 300); // 300ms delay to allow moving to modal
  }

  protected onModalHover(): void {
    // When hovering over the modal, cancel any pending close
    if (this.leaveTimeout) {
      clearTimeout(this.leaveTimeout);
    }
    this.globalModalService.onModalHover();
  }

  ngOnDestroy(): void {
    // Clear all timeouts
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }
    if (this.leaveTimeout) {
      clearTimeout(this.leaveTimeout);
    }
    
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
  }

  private setupGestureSupport(): void {
    if (!this.searchContainer) {
      return;
    }
    
    const hammer = new Hammer(this.searchContainer.nativeElement);
    
    // Configure swipe gestures for horizontal swipes only (don't interfere with vertical scrolling)
    const swipeRecognizer = hammer.get('swipe');
    if (swipeRecognizer) {
      // Only detect horizontal swipes, not vertical ones - this allows normal scrolling
      swipeRecognizer.set({ direction: Hammer.DIRECTION_HORIZONTAL });
    }
    
    // Swipe left to next tab
    hammer.on('swipeleft', (event) => {
      
      if (this.hasSearched) {
        // When searching, only allow swipe left from Top to People
        if (this.activeTab === 'top') {
          this.switchTab('people');
        } else if (this.activeTab === 'people') {
          // Swipe left from People tab does nothing (no content to the right visually)
        }
      } else {
        // When not searching (Trending tab), swipe left does nothing
      }
    });
    
    // Swipe right to previous tab or open sidebar
    hammer.on('swiperight', (event) => {
      
      if (this.hasSearched) {
        // When searching, handle tab switching
        if (this.activeTab === 'people') {
          // From People tab, go to Top tab
          this.switchTab('top');
        } else if (this.activeTab === 'top') {
          // From Top tab (leftmost), open sidebar
          this.openSidebar();
        }
      } else {
        // When not searching (Trending tab), swipe right opens sidebar
        this.openSidebar();
      }
    });

    // Add some debugging for other Hammer events
    hammer.on('pan', (event) => {
    });
    
    hammer.on('tap', (event) => {
    });

    // Add pull-to-refresh (only at top of page)
    this.setupPullToRefresh();
  }

  /**
   * Setup pull-to-refresh using touch events (only at top of page)
   */
  private setupPullToRefresh(): void {
    let startY = 0;
    let currentY = 0;
    const threshold = 100; // Minimum distance to trigger refresh
    
    const handleTouchStart = (e: TouchEvent) => {
      // Only detect at the very top of the page
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
      }
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      // Only process if we started at the top
      if (startY > 0) {
        currentY = e.touches[0].clientY;
        const deltaY = currentY - startY;
        
        // If pulling down more than threshold, trigger refresh
        if (deltaY > threshold) {
          this.pullToRefresh();
          startY = 0; // Reset to prevent multiple triggers
        }
      }
    };
    
    const handleTouchEnd = () => {
      startY = 0; // Reset
    };
    
    // Add touch event listeners to the search container
    const container = this.searchContainer?.nativeElement;
    if (container) {
      container.addEventListener('touchstart', handleTouchStart, { passive: true });
      container.addEventListener('touchmove', handleTouchMove, { passive: true });
      container.addEventListener('touchend', handleTouchEnd, { passive: true });
    }
  }

  /**
   * Pull to refresh functionality
   */
  private pullToRefresh(): void {
    
    // Set refreshing state to show loading row and keep content visible
    this.isRefreshing = true;
    this.cd.markForCheck(); // Trigger change detection
    
    // Force refresh trending and recommended users
    this.forceRefreshTrending();
    
    // If there's an active search, refresh those results too
    if (this.hasSearched) {
      this.performSearch(this.searchQuery);
    }
  }

  private openSidebar(): void {
    // Open the mobile sidebar via the service
    this.sidebarService.openSidebar();
  }

  /**
   * Load more posts for search results
   */
  loadMorePosts(): void {
    if (!this.hasMorePosts || this.isLoadingMorePosts || !this.searchQuery) {
      return;
    }

    this.isLoadingMorePosts = true;
    this.currentPostsPage++;

    this.postService.searchPosts(this.searchQuery, this.currentPostsPage, this.activeTab).subscribe({
      next: (response) => {
        // Filter out reposted posts and append to existing results
        const newPosts = response.results.filter((post: Post) => post.post_type !== 'repost');
        this.posts = [...this.posts, ...newPosts];
        
        // Update pagination state
        this.hasMorePosts = !!response.next;
        this.isLoadingMorePosts = false;
        
        this.cd.markForCheck();
      },
      error: (error) => {
        console.error('Error loading more posts:', error);
        this.currentPostsPage--; // Revert page number on error
        this.isLoadingMorePosts = false;
        this.cd.markForCheck();
      }
    });
  }

  /**
   * Load more users for search results
   */
  loadMoreUsers(): void {
    if (!this.hasMoreUsers || this.isLoadingMoreUsers || !this.searchQuery) {
      return;
    }

    this.isLoadingMoreUsers = true;
    this.currentUsersPage++;

    this.userService.searchUsers(this.searchQuery, this.currentUsersPage).subscribe({
      next: (response) => {
        // Append new users to existing results
        this.users = [...this.users, ...response.results];
        
        // Update pagination state
        this.hasMoreUsers = !!response.next;
        this.isLoadingMoreUsers = false;
        
        this.cd.markForCheck();
      },
      error: (error) => {
        console.error('Error loading more users:', error);
        this.currentUsersPage--; // Revert page number on error
        this.isLoadingMoreUsers = false;
        this.cd.markForCheck();
      }
    });
  }

  /**
   * Check if user has scrolled to bottom to trigger load more
   */
  @HostListener('window:scroll', ['$event'])
  onScroll(): void {
    if (this.hasSearched && this.searchQuery) {
      const scrollPosition = window.scrollY + window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      // Load more when user is near bottom (within 100px)
      if (documentHeight - scrollPosition < 100) {
        if (this.activeTab === 'top' && this.hasMorePosts && !this.isLoadingMorePosts) {
          this.loadMorePosts();
        } else if (this.activeTab === 'people' && this.hasMoreUsers && !this.isLoadingMoreUsers) {
          this.loadMoreUsers();
        }
      }
    }
  }
} 