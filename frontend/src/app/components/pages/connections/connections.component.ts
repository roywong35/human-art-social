import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { User } from '../../../models';
import { UserService } from '../../../services/user.service';
import { OptimisticUpdateService } from '../../../services/optimistic-update.service';
import { GlobalModalService } from '../../../services/global-modal.service';
import { AuthService } from '../../../services/auth.service';


interface UserWithState extends User {
  isFollowLoading?: boolean;
  isHoveringFollowButton?: boolean;
}

@Component({
  selector: 'app-connections',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './connections.component.html',
  styleUrls: ['./connections.component.scss']
})
export class ConnectionsComponent implements OnInit {
  activeTab: 'followers' | 'following' = 'followers';
  users: UserWithState[] = [];
  isLoading = true;
  error: string | null = null;
  username = '';
  handle = '';
  currentUser: User | null = null;
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  // User preview modal
  private hoverTimeout: any;
  private leaveTimeout: any;
  private lastHoveredElement: Element | null = null;

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private userService: UserService,
    private optimisticUpdateService: OptimisticUpdateService,
    private globalModalService: GlobalModalService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Get current user first
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });

    const handle = this.route.snapshot.paramMap.get('handle');
    if (!handle) {
      this.error = 'Invalid profile URL';
      this.isLoading = false;
      return;
    }

    // Get the initial tab from the URL if present
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'following' || tab === 'followers') {
      this.activeTab = tab;
    }

    // Get user info first
    this.userService.getUserByHandle(handle).subscribe({
      next: (user) => {
        this.username = user.username;
        this.handle = user.handle;
        this.loadUsers(handle);
      },
      error: (error) => {
        console.error('Error loading user:', error);
        this.error = 'Failed to load user information';
        this.isLoading = false;
      }
    });
  }

  setTab(tab: 'followers' | 'following'): void {
    this.activeTab = tab;
    this.isLoading = true;
    this.error = null;
    this.users = [];
    
    // Update URL without navigation
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge'
    });

    const handle = this.route.snapshot.paramMap.get('handle');
    if (handle) {
      this.loadUsers(handle);
    }
  }

  private loadUsers(handle: string): void {
    const request = this.activeTab === 'followers' 
      ? this.userService.getUserFollowers(handle)
      : this.userService.getUserFollowing(handle);

    request.subscribe({
      next: (users) => {
        this.users = users.map(user => ({
          ...user,
          isFollowLoading: false,
          isHoveringFollowButton: false
        }));
        this.isLoading = false;
      },
      error: (error) => {
        console.error(`Error loading ${this.activeTab}:`, error);
        this.error = `Failed to load ${this.activeTab}`;
        this.isLoading = false;
      }
    });
  }

  navigateToProfile(handle: string): void {
    this.router.navigate(['/', handle]);
  }

  followUser(user: UserWithState, event: Event): void {
    event.stopPropagation();
    if (user.isFollowLoading) return;

    user.isFollowLoading = true;
    
    // Apply optimistic update immediately
    let optimisticUser: User;
    if (user.is_following) {
      optimisticUser = this.optimisticUpdateService.getOptimisticUserForUnfollow(user);
    } else {
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
    
    // Make the API call
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

  onFollowButtonHover(user: UserWithState, hovering: boolean): void {
    user.isHoveringFollowButton = hovering;
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

  /**
   * Check if the follow button should be shown for a user
   * Hide the follow button if the current user is viewing their own connections
   */
  shouldShowFollowButton(user: UserWithState): boolean {
    return !!(this.currentUser && user.handle !== this.currentUser.handle);
  }
} 