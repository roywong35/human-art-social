import { Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
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
    private sidebarService: SidebarService
  ) {}

  ngOnInit() {
    // Get current user first
    const userSub = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
    this.subscriptions.push(userSub);

    // Subscribe to follow status changes for real-time sync
    this.setupFollowStatusSync();

    // Load trending hashtags and recommended users
    this.loadTrending(true);
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
    this.setupGestureSupport();
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
    this.isLoadingTrending = true;
    
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
        }
      }
    });
  }

  private loadRecommendedUsers() {
    this.isLoadingUsers = true;
    this.userService.getRecommendedUsersPaginated(1).subscribe({
      next: (response) => {
        this.recommendedUsers = response.results;
        this.isLoadingUsers = false;
        // Also clear the refresh state if this was called from pullToRefresh
        if (this.isRefreshing) {
          this.isRefreshing = false;
        }
      },
      error: (error) => {
        console.error('Error loading recommended users:', error);
        this.isLoadingUsers = false;
        // Also clear the refresh state if this was called from pullToRefresh
        if (this.isRefreshing) {
          this.isRefreshing = false;
        }
      }
    });
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
    // Only allow switching to tabs that are currently available
    if (tab === 'trending' && !this.hasSearched) {
      this.activeTab = tab;
    } else if ((tab === 'top' || tab === 'people') && this.hasSearched) {
      this.activeTab = tab;
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
    console.log('🔍 Smart Loading Logic Debug:', {
      hasSearched: this.hasSearched,
      usersLength: this.users.length,
      postsLength: this.posts.length,
      isLoading: this.isLoading,
      isRefreshing: this.isRefreshing,
      activeTab: this.activeTab
    });
    
    // If we have search results, keep them visible during refresh
    if (this.hasSearched && (this.users.length > 0 || this.posts.length > 0)) {
      console.log('✅ Should show content during loading: TRUE (has results)');
      return true;
    }
    // If no results yet, hide content during loading
    console.log('❌ Should show content during loading: FALSE (no results)');
    return false;
  }

  // Simplified logic for showing loading row
  get shouldShowLoadingRow(): boolean {
    // Show loading row for:
    // 1. Pull-to-refresh (isRefreshing = true)
    // 2. Initial search with no results yet (isLoading && hasSearched && no results)
    return this.isRefreshing || (this.isLoading && this.hasSearched && this.users.length === 0 && this.posts.length === 0);
  }

  // Debug method to log template conditions
  logTemplateConditions(): void {
    console.log('🎯 Template Conditions Debug:', {
      hasSearched: this.hasSearched,
      activeTab: this.activeTab,
      usersLength: this.users.length,
      postsLength: this.posts.length,
      shouldShowContentDuringLoading: this.shouldShowContentDuringLoading,
      isLoading: this.isLoading,
      isRefreshing: this.isRefreshing,
      tabsCondition: this.hasSearched && (this.users.length > 0 || this.posts.length > 0),
      topTabCondition: this.hasSearched && this.activeTab === 'top' && (this.users.length > 0 || this.posts.length > 0),
      peopleTabCondition: this.hasSearched && this.activeTab === 'people' && this.users.length > 0
    });
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

    console.log('🔍 Perform Search Started:', {
      query: query,
      hasSearched: this.hasSearched,
      usersLength: this.users.length,
      postsLength: this.posts.length,
      isRefreshing: this.isRefreshing
    });

    this.isLoading = true;
    
    // Only clear results on initial search, not on refresh
    if (!this.isRefreshing) {
      this.posts = [];
      this.users = [];
      console.log('🔍 Cleared results (initial search)');
    } else {
      console.log('🔍 Kept existing results (refresh)');
    }
    
    this.hasSearched = true;
    
    console.log('🔍 Set loading states:', {
      isLoading: this.isLoading,
      hasSearched: this.hasSearched,
      posts: this.posts.length,
      users: this.users.length,
      isRefreshing: this.isRefreshing
    });

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
      this.isLoadingUsers = true;
      this.isLoadingPosts = true;
      
      forkJoin({
        users: this.userService.searchUsers(userSearchTerm),
        posts: this.postService.searchPosts(postSearchTerm)
      }).subscribe({
        next: (results) => {
          console.log('🔍 Search Results Received:', {
            usersCount: results.users.length,
            postsCount: results.posts.length,
            isRefreshing: this.isRefreshing
          });
          
          this.users = results.users;
          // Filter out reposted posts from search results
          this.posts = results.posts.filter(post => post.post_type !== 'repost');
          
          this.hasSearched = true;
          
          this.isLoading = false;
          this.isLoadingUsers = false;
          this.isLoadingPosts = false;
          
          console.log('🔍 After Setting Results:', {
            hasSearched: this.hasSearched,
            usersLength: this.users.length,
            postsLength: this.posts.length,
            isLoading: this.isLoading,
            isRefreshing: this.isRefreshing
          });
          
          // Also clear refresh state if this was a refresh operation
          if (this.isRefreshing) {
            this.isRefreshing = false;
            console.log('🔄 Cleared isRefreshing = false');
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
          }
        }
      });
    }
  }

  private searchPosts(query: string) {
    this.isLoadingPosts = true;
    this.hasSearched = true;
    
    // Only clear results on initial search, not on refresh
    if (!this.isRefreshing) {
      this.posts = [];
      console.log('🔍 searchPosts: Cleared results (initial search)');
    } else {
      console.log('🔍 searchPosts: Kept existing results (refresh)');
    }
    
    this.postService.searchPosts(query).subscribe({
      next: (posts) => {
        // Filter out reposted posts from search results
        this.posts = posts.filter(post => post.post_type !== 'repost');
        this.hasSearched = true;
        this.isLoading = false;
        this.isLoadingPosts = false;
        // Also clear refresh state if this was a refresh operation
        if (this.isRefreshing) {
          this.isRefreshing = false;
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
    if (!this.searchContainer) return;
    
    const hammer = new Hammer(this.searchContainer.nativeElement);
    
    // Configure swipe gestures for horizontal swipes
    hammer.get('swipe').set({ direction: Hammer.DIRECTION_HORIZONTAL });
    
    // Swipe left to next tab
    hammer.on('swipeleft', () => {
      this.swipeToNextTab();
    });
    
    // Swipe right to previous tab or open sidebar
    hammer.on('swiperight', () => {
      this.swipeToPreviousTab();
    });

    // Configure pull-to-refresh gesture
    hammer.get('swipe').set({ direction: Hammer.DIRECTION_ALL });
    
    // Swipe down to refresh content
    hammer.on('swipedown', () => {
      this.pullToRefresh();
    });
  }

  private swipeToNextTab(): void {
    if (this.hasSearched) {
      // When searching, switch between 'top' and 'people' tabs
      if (this.activeTab === 'top') {
        this.switchTab('people');
      }
    } else {
      // When not searching, stay on 'trending' tab
      // Could add more tabs here in the future
    }
  }

  private swipeToPreviousTab(): void {
    if (this.hasSearched) {
      // When searching, switch between 'top' and 'people' tabs
      if (this.activeTab === 'people') {
        this.switchTab('top');
      } else if (this.activeTab === 'top') {
        // If we're on the leftmost tab, open the sidebar
        this.openSidebar();
      }
    } else {
      // When not searching, open sidebar from 'trending' tab
      this.openSidebar();
    }
  }

  private openSidebar(): void {
    // Open the mobile sidebar via the service
    this.sidebarService.openSidebar();
  }

  private pullToRefresh(): void {
    console.log('🔄 Pull to Refresh Started:', {
      hasSearched: this.hasSearched,
      searchQuery: this.searchQuery,
      usersLength: this.users.length,
      postsLength: this.posts.length,
      activeTab: this.activeTab
    });
    
    // Show refresh state (keeps content visible)
    this.isRefreshing = true;
    console.log('🔄 Set isRefreshing = true');
    
    if (this.hasSearched) {
      console.log('🔄 Refreshing search results for:', this.searchQuery);
      // Refresh search results
      this.performSearch(this.searchQuery);
    } else {
      console.log('🔄 Refreshing trending content');
      // Refresh trending hashtags and recommended users
      this.loadTrending(true);
      this.loadRecommendedUsers();
    }
    
    // Don't manually set isRefreshing to false - let the actual operations handle it
    // This prevents the "No results found" flash
    
    // Log template conditions for debugging
    setTimeout(() => {
      this.logTemplateConditions();
    }, 100);
  }
} 