import { Component, OnInit, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { User } from '../../../models';
import { UserService } from '../../../services/user.service';
import { OptimisticUpdateService } from '../../../services/optimistic-update.service';
import { GlobalModalService } from '../../../services/global-modal.service';

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
    private elementRef: ElementRef
  ) {}

  ngOnInit() {
    this.loadUsers();
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
    
    // Apply optimistic update immediately based on current state
    let optimisticUser: User;
    if (user.is_following) {
      // User is currently following, so unfollow
      optimisticUser = this.optimisticUpdateService.getOptimisticUserForUnfollow(user);
    } else {
      // User is not following, so follow
      optimisticUser = this.optimisticUpdateService.getOptimisticUserForFollow(user);
    }
    
    const index = this.users.findIndex(u => u.handle === user.handle);
    if (index !== -1) {
      this.users[index] = {
        ...optimisticUser,
        isFollowLoading: true,
        isHoveringFollowButton: false
      };
    }
    
    // Make the API call based on current state
    const request = user.is_following
      ? this.optimisticUpdateService.unfollowUserOptimistic(user)
      : this.optimisticUpdateService.followUserOptimistic(user);

    request.subscribe({
      next: (updatedUser) => {
        // Update with real response
        if (index !== -1) {
          this.users[index] = {
            ...updatedUser,
            isFollowLoading: false,
            isHoveringFollowButton: false
          };
        }
      },
      error: (error: unknown) => {
        console.error('Error following/unfollowing user:', error);
        // Rollback to original state on error
        if (index !== -1) {
          this.users[index] = {
            ...user,
            isFollowLoading: false,
            isHoveringFollowButton: false
          };
        }
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
      
      // Use the new accurate positioning method (no shifting!)
      this.globalModalService.showUserPreviewAccurate(user, this.lastHoveredElement, {
        clearLeaveTimeout: () => {
          if (this.leaveTimeout) {
            clearTimeout(this.leaveTimeout);
          }
        }
      });
    }, 300); // 300ms delay - faster than Twitter
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