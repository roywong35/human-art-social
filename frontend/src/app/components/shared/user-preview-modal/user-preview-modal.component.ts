import { Component, Input, Output, EventEmitter, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { User } from '../../../models/user.model';
import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';
import { OptimisticUpdateService } from '../../../services/optimistic-update.service';
import { MatDialog } from '@angular/material/dialog';
import { UnfollowDialogComponent } from '../../dialogs/unfollow-dialogs/unfollow-dialog.component';

@Component({
  selector: 'app-user-preview-modal',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './user-preview-modal.component.html',
  styleUrls: ['./user-preview-modal.component.scss']
})
export class UserPreviewModalComponent implements OnInit, OnChanges {
  @Input() user: User | null = null;
  @Input() isVisible: boolean = false;
  @Input() position: { x: number, y: number } = { x: 0, y: 0 };
  @Output() close = new EventEmitter<void>();
  @Output() modalHover = new EventEmitter<void>();
  @Output() modalLeave = new EventEmitter<void>();

  isCurrentUser: boolean = false;
  isFollowLoading: boolean = false;
  defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private optimisticUpdateService: OptimisticUpdateService,
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    this.checkIfCurrentUser();
  }

  ngOnChanges() {
    this.checkIfCurrentUser();
  }



  private checkIfCurrentUser() {
    this.authService.currentUser$.subscribe(currentUser => {
      this.isCurrentUser = currentUser?.handle === this.user?.handle;
    });
  }

  async followUser(): Promise<void> {
    if (!this.user || this.isFollowLoading) return;

    this.isFollowLoading = true;

    // If already following, show confirmation dialog
    if (this.user.is_following) {
      const dialogRef = this.dialog.open(UnfollowDialogComponent, {
        data: { handle: this.user.handle },
        panelClass: 'unfollow-dialog-fixed'
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          this.performUnfollow();
        } else {
          this.isFollowLoading = false;
        }
      });
    } else {
      // Follow the user with optimistic update
      if (this.user) {
        // Apply optimistic update immediately
        const optimisticUser = this.optimisticUpdateService.getOptimisticUserForFollow(this.user);
        this.user.is_following = optimisticUser.is_following;
        this.user.followers_count = optimisticUser.followers_count;
      }
      
      this.optimisticUpdateService.followUserOptimistic(this.user!).subscribe({
        next: () => {
          this.isFollowLoading = false;
        },
        error: (error: any) => {
          console.error('Error following user:', error);
          // Rollback optimistic update on error
          if (this.user) {
            this.user.is_following = false;
            this.user.followers_count = Math.max((this.user.followers_count || 0) - 1, 0);
          }
          this.isFollowLoading = false;
        }
      });
    }
  }

  private performUnfollow(): void {
    if (!this.user) return;

    // Apply optimistic update immediately
    if (this.user) {
      const optimisticUser = this.optimisticUpdateService.getOptimisticUserForUnfollow(this.user);
      this.user.is_following = optimisticUser.is_following;
      this.user.followers_count = optimisticUser.followers_count;
    }

    this.optimisticUpdateService.unfollowUserOptimistic(this.user!).subscribe({
      next: () => {
        this.isFollowLoading = false;
      },
      error: (error: any) => {
        console.error('Error unfollowing user:', error);
        // Rollback optimistic update on error
        if (this.user) {
          this.user.is_following = true;
          this.user.followers_count = (this.user.followers_count || 0) + 1;
        }
        this.isFollowLoading = false;
      }
    });
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