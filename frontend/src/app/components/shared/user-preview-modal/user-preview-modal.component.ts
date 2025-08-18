import { Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { User } from '../../../models/user.model';
import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';
import { OptimisticUpdateService } from '../../../services/optimistic-update.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-user-preview-modal',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './user-preview-modal.component.html',
  styleUrls: ['./user-preview-modal.component.scss']
})
export class UserPreviewModalComponent implements OnInit, OnChanges, OnDestroy {
  @Input() user: User | null = null;
  @Input() isVisible: boolean = false;
  @Input() position: { x: number, y: number } = { x: 0, y: 0 };
  @Output() close = new EventEmitter<void>();
  @Output() modalHover = new EventEmitter<void>();
  @Output() modalLeave = new EventEmitter<void>();

  isCurrentUser: boolean = false;
  isFollowLoading: boolean = false;
  defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM3MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private optimisticUpdateService: OptimisticUpdateService,
  ) {}

  ngOnInit() {
    this.setupCurrentUserSubscription();
    // Remove the follow status sync subscription - modal updates its own UI immediately
  }

  ngOnChanges() {
    this.setupCurrentUserSubscription();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupCurrentUserSubscription() {
    // Clear any existing subscription
    this.destroy$.next();
    
    if (this.user) {
      this.authService.currentUser$.pipe(
        takeUntil(this.destroy$)
      ).subscribe(currentUser => {
        this.isCurrentUser = currentUser?.handle === this.user?.handle;
      });
    }
  }

  // Remove the setupFollowStatusSync method since we don't need it anymore

  async followUser(): Promise<void> {
    if (!this.user || this.isFollowLoading) return;

    this.isFollowLoading = true;

    // Store a local reference to the user to prevent it from becoming null
    const currentUser = this.user;

    try {
      // If already following, unfollow directly (no dialog)
      if (currentUser.is_following) {
        // Update UI immediately for unfollow
        currentUser.is_following = false;
        currentUser.followers_count = Math.max((currentUser.followers_count || 0) - 1, 0);
        
        this.performUnfollow(currentUser);
      } else {
        // Update UI immediately for follow
        currentUser.is_following = true;
        currentUser.followers_count = (currentUser.followers_count || 0) + 1;
        
        // Follow the user - let the service handle optimistic updates
        this.optimisticUpdateService.followUserOptimistic(currentUser!).subscribe({
          next: () => {
            this.isFollowLoading = false;
          },
          error: (error: any) => {
            console.error('Error following user:', error);
            // Revert the UI change on error
            currentUser.is_following = false;
            currentUser.followers_count = Math.max((currentUser.followers_count || 0) - 1, 0);
            this.isFollowLoading = false;
          }
        });
      }
    } catch (error) {
      console.error('Error in followUser:', error);
      this.isFollowLoading = false;
    }
  }

  private performUnfollow(user: User): void {
    if (!user) {
      console.error('performUnfollow: user is null!');
      return;
    }

    try {
      // Let the service handle optimistic updates
      this.optimisticUpdateService.unfollowUserOptimistic(user!).subscribe({
        next: (updatedUser) => {
          this.isFollowLoading = false;
        },
        error: (error: any) => {
          console.error('Error unfollowing user:', error);
          // Revert the UI change on error
          user.is_following = true;
          user.followers_count = (user.followers_count || 0) + 1;
          this.isFollowLoading = false;
        }
      });
    } catch (error) {
      console.error('Error in performUnfollow:', error);
      this.isFollowLoading = false;
    }
  }

  onFollowButtonHover(isHovering: boolean): void {
    // Handle hover effects if needed
  }

  goToProfile(): void {
    this.close.emit();
  }

  onModalHover(): void {
    // When hovering over the modal, prevent it from closing
    this.modalHover.emit();
  }

  onModalLeave(): void {
    // When leaving the modal, close it
    this.modalLeave.emit();
  }
} 