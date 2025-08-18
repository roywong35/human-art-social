import { Component, ElementRef, OnInit, OnDestroy, HostBinding, Renderer2, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { SearchBarComponent } from '../../widgets/search-bar/search-bar.component';
import { HashtagResult, HashtagService } from '../../../services/hashtag.service';
import { UserService } from '../../../services/user.service';
import { OptimisticUpdateService } from '../../../services/optimistic-update.service';
import { User } from '../../../models';
import { GlobalModalService } from '../../../services/global-modal.service';
import { AuthService } from '../../../services/auth.service';
import { take } from 'rxjs/operators';

interface TrendingTopic {
  name: string;
  postCount: number;
  category: string;
}

interface UserWithState extends User {
  isFollowLoading?: boolean;
  isHoveringFollowButton?: boolean;
}

@Component({
  selector: 'app-right-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SearchBarComponent],
  templateUrl: './right-sidebar.component.html',
  styleUrls: ['./right-sidebar.component.scss']
})
export class RightSidebarComponent implements OnInit, OnDestroy {
  @HostBinding('class.sticky') isSticky = false;
  private initialTop: number | null = null;
  private sidebarHeight: number = 0;
  private sidebarWidth: number = 0;
  private lastScrollY: number = 0;
  trendingTopics: HashtagResult[] = [];
  readonly maxTrendingTopics = 5;
  isLoadingTrending = false;
  recommendedUsers: UserWithState[] = [];
  isLoadingUsers = false;
  readonly maxRecommendedUsers = 3;
  currentUser: User | null = null;
  defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM3MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  // User preview modal - now handled by GlobalModalService
  private hoverTimeout: any;
  private leaveTimeout: any;

  get displayedUsers(): UserWithState[] {
    return this.recommendedUsers.slice(0, this.maxRecommendedUsers);
  }

  get userPlaceholderCount(): number {
    return Math.max(0, this.maxRecommendedUsers - this.displayedUsers.length);
  }

  get userPlaceholderArray(): number[] {
    return Array(this.userPlaceholderCount).fill(0);
  }

  get placeholderCount(): number {
    return Math.max(0, this.maxTrendingTopics - this.trendingTopics.length);
  }

  get placeholderArray(): number[] {
    return Array(this.placeholderCount).fill(0);
  }

  private scrollHandler: () => void;
  private destroy$ = new Subject<void>();

  constructor(
    private elementRef: ElementRef,
    private renderer: Renderer2,
    private hashtagService: HashtagService,
    private userService: UserService,
    private optimisticUpdateService: OptimisticUpdateService,
    private router: Router,
    private cd: ChangeDetectorRef,
    private globalModalService: GlobalModalService,
    private authService: AuthService
  ) {
    this.scrollHandler = () => {
      const rect = this.elementRef.nativeElement.getBoundingClientRect();
      if (this.initialTop === null) {
        this.initialTop = rect.top + window.scrollY;
        // Store the initial width if not already set
        if (!this.sidebarWidth) {
          this.sidebarWidth = rect.width;
        }
      }
      
      // Update height on every scroll
      this.sidebarHeight = rect.height;

      const scrollY = window.scrollY;
      const viewportHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      // Check if viewport has enough height for the sidebar
      const hasEnoughHeight = viewportHeight >= this.sidebarHeight;

      if (hasEnoughHeight) {
        // If viewport is tall enough, keep sidebar fixed at the top
        this.isSticky = true;
        this.renderer.setStyle(this.elementRef.nativeElement, 'position', 'fixed');
        this.renderer.setStyle(this.elementRef.nativeElement, 'top', '0');
        this.renderer.setStyle(this.elementRef.nativeElement, 'width', `${this.sidebarWidth}px`);
        // Force change detection after style changes
        this.cd.detectChanges();
      } else {
        // If viewport is not tall enough, use the original scroll-based logic
        const shouldBeSticky = this.initialTop !== null && 
                             scrollY > (this.initialTop + this.sidebarHeight - viewportHeight);

        if (shouldBeSticky) {
          this.isSticky = true;
          const topPosition = viewportHeight - this.sidebarHeight;
          this.renderer.setStyle(this.elementRef.nativeElement, 'position', 'fixed');
          this.renderer.setStyle(this.elementRef.nativeElement, 'top', `${topPosition}px`);
          this.renderer.setStyle(this.elementRef.nativeElement, 'width', `${this.sidebarWidth}px`);
          // Force change detection after style changes
          this.cd.detectChanges();
        } else {
          this.isSticky = false;
          this.renderer.removeStyle(this.elementRef.nativeElement, 'position');
          this.renderer.removeStyle(this.elementRef.nativeElement, 'top');
          this.renderer.removeStyle(this.elementRef.nativeElement, 'width');
          // Force change detection after style changes
          this.cd.detectChanges();
        }
      }
    };
  }

  ngOnInit() {
    // Get current user first
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });

    this.loadTrending(true);  // Force fresh data on page load
    this.loadRecommendedUsers();
    this.setupScrollHandler();
    
    // Subscribe to follow status changes for real-time sync
    this.setupFollowStatusSync();
    
    // Refresh trending topics every 5 minutes
    setInterval(() => {
      this.loadTrending();  // Regular refresh every 5 minutes
    }, 5 * 60 * 1000);
  }

  private setupFollowStatusSync(): void {
    // Subscribe to follow status changes to update user lists in real-time
    this.optimisticUpdateService.followStatusChanges.subscribe(change => {
      if (change && this.recommendedUsers.length > 0) {
        // Find and update the user in the list
        const userIndex = this.recommendedUsers.findIndex(user => user.handle === change.userHandle);
        if (userIndex !== -1) {
          this.recommendedUsers[userIndex].is_following = change.isFollowing;
          this.recommendedUsers[userIndex].followers_count = change.followersCount;
          // Trigger change detection to update the UI
          this.cd.markForCheck();
        }
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
    }
    
    // Clean up user preview modal timeouts
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }
    if (this.leaveTimeout) {
      clearTimeout(this.leaveTimeout);
    }
  }

  navigateToHashtag(hashtag: string) {
    this.router.navigate(['/search'], { queryParams: { q: `#${hashtag}` } });
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

  private setupScrollHandler() {
    // Initial calculation
    setTimeout(() => {
      const rect = this.elementRef.nativeElement.getBoundingClientRect();
      this.initialTop = rect.top + window.scrollY;
      this.sidebarHeight = rect.height;
      this.sidebarWidth = rect.width; // Store the initial width
    }, 0);

    window.addEventListener('scroll', this.scrollHandler, { passive: true });
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
      }
    });
  }

  private loadRecommendedUsers() {
    this.isLoadingUsers = true;
    this.userService.getRecommendedUsersPaginated(1).subscribe({
      next: (response) => {
        this.recommendedUsers = response.results.map(user => ({
          ...user,
          isFollowLoading: false,
          isHoveringFollowButton: false
        }));
        this.isLoadingUsers = false;
      },
      error: (error) => {
        console.error('Error loading recommended users:', error);
        this.isLoadingUsers = false;
      }
    });
  }

  navigateToProfile(handle: string) {
    this.router.navigate(['/', handle]);
  }

  followUser(user: UserWithState, event: Event) {
    event.stopPropagation(); // Prevent navigation when clicking follow button
    if (user.isFollowLoading) return;

    user.isFollowLoading = true;
    
    // Let the service handle optimistic updates - the subscription will update the UI
    const request = user.is_following
      ? this.optimisticUpdateService.unfollowUserOptimistic(user)
      : this.optimisticUpdateService.followUserOptimistic(user);

    request.subscribe({
      next: (updatedUser) => {
        // The service will handle optimistic updates and notifications
        user.isFollowLoading = false;
      },
      error: (error) => {
        console.error('Error following/unfollowing user:', error);
        user.isFollowLoading = false;
      }
    });
  }

  onFollowButtonHover(user: UserWithState, isHovering: boolean) {
    user.isHoveringFollowButton = isHovering;
  }

  /**
   * Check if the follow button should be shown for a user
   * Hide the follow button if the current user is viewing their own profile
   */
  shouldShowFollowButton(user: UserWithState): boolean {
    return !!(this.currentUser && user.handle !== this.currentUser.handle);
  }

  // User preview modal methods
  protected onUserHover(event: MouseEvent, user: User): void {
    // Clear any pending timeouts
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }
    if (this.leaveTimeout) {
      clearTimeout(this.leaveTimeout);
    }

    this.hoverTimeout = setTimeout(() => {
      const targetElement = event.target as Element;
      
      // X approach: Pre-fetch full user data before showing modal
      // This ensures counts and follow button state are ready immediately
      this.userService.getUserByHandle(user.handle).pipe(take(1)).subscribe({
        next: (fullUser) => {
          // Show modal with complete data - no more delayed counts!
          this.globalModalService.showUserPreviewAccurate(fullUser, targetElement, {
            clearLeaveTimeout: () => {
              if (this.leaveTimeout) {
                clearTimeout(this.leaveTimeout);
              }
            }
          });
        },
        error: () => {
          // Fallback: show lightweight preview if fetch fails
          this.globalModalService.showUserPreviewAccurate(user, targetElement, {
            clearLeaveTimeout: () => {
              if (this.leaveTimeout) {
                clearTimeout(this.leaveTimeout);
              }
            }
          });
        }
      });
    }, 200); // Reduced to 200ms for X-like responsiveness
  }

  protected onUserHoverLeave(): void {

    
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }
    
    // Delay hiding to allow moving to the modal
    this.leaveTimeout = setTimeout(() => {
      if (!this.globalModalService.getCurrentState().isVisible) return;

      this.globalModalService.hideUserPreview();
    }, 300);
  }

  protected onModalHover(): void {
    // When hovering over the modal, cancel any pending close
    if (this.leaveTimeout) {
      clearTimeout(this.leaveTimeout);
    }
    this.globalModalService.onModalHover();
  }

  protected closeUserPreview(): void {
    // Clear any pending timeouts
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }
    if (this.leaveTimeout) {
      clearTimeout(this.leaveTimeout);
    }
    
    this.globalModalService.hideUserPreview();
  }
} 