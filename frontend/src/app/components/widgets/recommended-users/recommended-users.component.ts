import { Component, OnInit, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { User } from '../../../models';
import { UserService } from '../../../services/user.service';
import { OptimisticUpdateService } from '../../../services/optimistic-update.service';
import { GlobalModalService } from '../../../services/global-modal.service';
import { AuthService } from '../../../services/auth.service';
import { take } from 'rxjs';

// Extend the User type to include our UI states
interface UserWithState extends User {
  isFollowLoading?: boolean;
  isHoveringFollowButton?: boolean;
}

@Component({
  selector: 'app-recommended-users',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './recommended-users.component.html',
  styleUrls: ['./recommended-users.component.scss']
})
export class RecommendedUsersComponent implements OnInit {
  users: UserWithState[] = [];
  isLoading = false;
  isLoadingMore = false;
  hasMore = true;
  currentPage = 1;
  currentUser: User | null = null;
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  // User preview modal
  private hoverTimeout: any;
  private leaveTimeout: any;
  private lastHoveredElement: Element | null = null;

  constructor(
    private userService: UserService,
    private optimisticUpdateService: OptimisticUpdateService,
    private router: Router,
    private globalModalService: GlobalModalService,
    private elementRef: ElementRef,
    private authService: AuthService
  ) {}

  ngOnInit() {
    // Subscribe to follow status changes for real-time sync
    this.setupFollowStatusSync();

    // Load initial users
    this.loadUsers();
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

  loadUsers() {
    this.isLoading = true;
    this.currentPage = 1;
    this.hasMore = true;
    this.userService.getRecommendedUsersPaginated(1).subscribe({
      next: (response) => {
        this.users = response.results.map(user => ({
          ...user,
          isFollowLoading: false,
          isHoveringFollowButton: false
        }));
        this.hasMore = !!response.next;
        this.isLoading = false;
      },
      error: (error: unknown) => {
        console.error('RecommendedUsersComponent: Error loading users:', error);
        this.isLoading = false;
      }
    });
  }

  loadMoreUsers() {
    if (this.isLoadingMore || !this.hasMore) return;

    this.isLoadingMore = true;
    this.currentPage++;
    
    this.userService.getRecommendedUsersPaginated(this.currentPage).subscribe({
      next: (response) => {
        const newUsers = response.results.map(user => ({
          ...user,
          isFollowLoading: false,
          isHoveringFollowButton: false
        }));
        this.users = [...this.users, ...newUsers];
        this.hasMore = !!response.next;
        this.isLoadingMore = false;
      },
      error: (error: unknown) => {
        console.error('RecommendedUsersComponent: Error loading more users:', error);
        this.isLoadingMore = false;
        this.currentPage--; // Revert page increment on error
      }
    });
  }

  followUser(user: UserWithState, event: Event) {
    event.stopPropagation();
    if (user.isFollowLoading) return;

    user.isFollowLoading = true;
    
    // Let the service handle optimistic updates
    const request = user.is_following
      ? this.optimisticUpdateService.unfollowUserOptimistic(user)
      : this.optimisticUpdateService.followUserOptimistic(user);

    request.subscribe({
      next: (updatedUser) => {
        // The service will handle optimistic updates and notifications
        user.isFollowLoading = false;
      },
      error: (error: unknown) => {
        console.error('Error following/unfollowing user:', error);
        user.isFollowLoading = false;
      }
    });
  }

  onFollowButtonHover(user: UserWithState, isHovering: boolean) {
    user.isHoveringFollowButton = isHovering;
  }

  navigateToProfile(handle: string) {
    this.router.navigate(['/', handle]);
  }

  @HostListener('window:scroll', ['$event'])
  onScroll() {
    const element = this.elementRef.nativeElement;
    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    
    // Check if we're near the bottom of the component (within 200px)
    if (rect.bottom <= windowHeight + 200 && this.hasMore && !this.isLoadingMore) {
      this.loadMoreUsers();
    }
  }

  // User preview modal methods
  protected onUserHover(event: MouseEvent, user: UserWithState): void {
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
    }, 200); // Reduced to 200ms for X-like responsiveness
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

  /**
   * Check if the follow button should be shown for a user
   * Hide the follow button if the current user is viewing their own profile
   */
  shouldShowFollowButton(user: UserWithState): boolean {
    return !!(this.currentUser && user.handle !== this.currentUser.handle);
  }
} 