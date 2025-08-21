import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Post } from '../../../models/post.model';
import { User } from '../../../models/user.model';
import { PostService } from '../../../services/post.service';
import { UserService } from '../../../services/user.service';
import { OptimisticUpdateService } from '../../../services/optimistic-update.service';
import { AuthService } from '../../../services/auth.service';
import { PostComponent } from '../../features/posts/post/post.component';
import { SearchBarComponent } from '../../widgets/search-bar/search-bar.component';
import { GlobalModalService } from '../../../services/global-modal.service';
import { forkJoin } from 'rxjs';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchBarComponent, PostComponent],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent implements OnInit {
  searchQuery: string = '';
  posts: Post[] = [];
  users: User[] = [];
  isLoading: boolean = false;
  isHashtagSearch: boolean = false;
  hasSearched: boolean = false;
  
  // Tab management
  activeTab: 'top' | 'people' = 'top';
  
  // Loading states for different sections
  isLoadingPosts: boolean = false;
  isLoadingUsers: boolean = false;

  // Current user tracking
  currentUser: User | null = null;

  // User preview modal properties
  private hoverTimeout: any;
  private leaveTimeout: any;
  private lastHoveredElement: Element | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private postService: PostService,
    private userService: UserService,
    private optimisticUpdateService: OptimisticUpdateService,
    private authService: AuthService,
    private globalModalService: GlobalModalService
  ) {}

  ngOnInit() {
    // Get current user first
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });

    // Subscribe to follow status changes for real-time sync
    this.setupFollowStatusSync();

    // Get the initial tab from the URL if present
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab && ['top', 'latest', 'people', 'posts'].includes(tab)) {
      this.activeTab = tab as any;
    }

    // Get the initial search query from the URL if present
    const query = this.route.snapshot.queryParamMap.get('q');
    if (query) {
      this.searchQuery = query;
      this.performSearch(query);
    }
  }

  private setupFollowStatusSync(): void {
    // Subscribe to follow status changes to update user lists in real-time
    this.optimisticUpdateService.followStatusChanges.subscribe(change => {
      if (change && this.users.length > 0) {
        // Find and update the user in the list
        const userIndex = this.users.findIndex(user => user.handle === change.userHandle);
        if (userIndex !== -1) {
          this.users[userIndex].is_following = change.isFollowing;
          this.users[userIndex].followers_count = change.followersCount;
        }
      }
    });
  }

  goBack() {
    this.router.navigate(['/']);
  }

  switchTab(tab: 'top' | 'people') {
    this.activeTab = tab;
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

  private performSearch(query: string) {
    if (!query.trim()) {
      this.posts = [];
      this.users = [];
      this.isLoading = false;
      this.hasSearched = false;
      return;
    }

    this.isLoading = true;
    this.posts = [];
    this.users = [];
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
      this.isLoadingUsers = true;
      this.isLoadingPosts = true;
      
      forkJoin({
        users: this.userService.searchUsers(userSearchTerm),
        posts: this.postService.searchPosts(postSearchTerm)
      }).subscribe({
        next: (results) => {
          this.users = results.users;
          // Filter out reposted posts from search results
          this.posts = results.posts.filter(post => post.post_type !== 'repost');
          
          this.hasSearched = true;
          
          this.isLoading = false;
          this.isLoadingUsers = false;
          this.isLoadingPosts = false;
        },
        error: (error) => {
          console.error('Error searching:', error);
          this.users = [];
          this.posts = [];
          this.isLoading = false;
          this.isLoadingUsers = false;
          this.isLoadingPosts = false;
          this.hasSearched = true;
        }
      });
    }
  }

  private searchPosts(query: string) {
    this.isLoadingPosts = true;
    this.hasSearched = true;
    
    this.postService.searchPosts(query).subscribe({
      next: (posts) => {
        // Filter out reposted posts from search results
        this.posts = posts.filter(post => post.post_type !== 'repost');
        this.hasSearched = true;
        this.isLoading = false;
        this.isLoadingPosts = false;
      },
      error: (error) => {
        console.error('Error searching posts:', error);
        this.posts = [];
        this.isLoading = false;
        this.isLoadingPosts = false;
        this.hasSearched = true;
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
} 