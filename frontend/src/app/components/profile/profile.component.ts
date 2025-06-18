import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ActivatedRoute, Router } from '@angular/router';
import { User } from '../../models/user.model';
import { Post } from '../../models/post.model';
import { UserService } from '../../services/user.service';
import { PostService } from '../../services/post.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { PostComponent } from '../shared/post/post.component';
import { take } from 'rxjs/operators';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { UserListDialogComponent } from '../shared/user-list-dialog/user-list-dialog.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-unfollow-dialog',
  template: `
    <div class="p-6 max-w-sm">
      <h2 class="text-xl font-bold mb-4">Unfollow {{'@'}}{{ data.handle }}</h2>
      <p class="text-gray-600 mb-6">Their posts will no longer show up in your home timeline.</p>
      <div class="flex justify-end gap-3">
        <button mat-button 
                class="px-4 py-2 rounded-full hover:bg-gray-100" 
                (click)="onCancel()">
          Cancel
        </button>
        <button mat-button 
                class="px-4 py-2 rounded-full bg-black text-white hover:bg-gray-900" 
                (click)="onConfirm()">
          Unfollow
        </button>
      </div>
    </div>
  `,
  standalone: true,
  imports: [CommonModule, MatDialogModule]
})
export class UnfollowDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<UnfollowDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { handle: string }
  ) {}

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    RouterModule, 
    PostComponent, 
    MatDialogModule,
    UserListDialogComponent
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit, OnDestroy {
  private routeSubscription: Subscription | undefined;
  user: User | null = null;
  posts: Post[] = [];
  isLoading = true;
  error: string | null = null;
  isCurrentUser = false;
  showEditModal = false;
  isFollowLoading = false;
  isHoveringFollowButton = false;
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';
  editForm = {
    username: '',
    bio: '',
    profile_picture: null as File | null,
    banner_image: null as File | null
  };

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private userService: UserService,
    private postService: PostService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    // Subscribe to route parameter changes
    this.routeSubscription = this.route.paramMap.subscribe(params => {
      const handle = params.get('handle');
      console.log('ProfileComponent: Route params changed, handle:', handle);
      if (!handle) {
        this.error = 'Invalid profile URL';
        this.isLoading = false;
        return;
      }

      // Reset state
      this.isLoading = true;
      this.error = null;
      this.user = null;
      this.posts = [];

      this.loadUserProfile(handle);
    });
  }

  ngOnDestroy(): void {
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
  }

  private loadUserProfile(handle: string): void {
    console.log('ProfileComponent: Loading user profile for handle:', handle);
    this.userService.getUserByHandle(handle).subscribe({
      next: (user) => {
        console.log('ProfileComponent: User profile loaded:', user);
        this.user = user;
        this.authService.currentUser$.pipe(take(1)).subscribe(currentUser => {
          this.isCurrentUser = currentUser?.id === user.id;
        });
        this.loadUserPosts(handle);
      },
      error: (error) => {
        console.error('ProfileComponent: Error loading profile:', error);
        this.error = 'Failed to load profile';
        this.isLoading = false;
      }
    });
  }

  private loadUserPosts(handle: string): void {
    this.postService.getUserPosts(handle).subscribe({
      next: (posts) => {
        this.posts = posts;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading posts:', error);
        this.error = 'Failed to load posts';
        this.isLoading = false;
      }
    });
  }

  onBannerImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.editForm.banner_image = input.files[0];
    }
  }

  onProfilePictureSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.editForm.profile_picture = input.files[0];
    }
  }

  openEditModal(): void {
    if (this.user) {
      this.editForm.username = this.user.username;
      this.editForm.bio = this.user.bio || '';
    }
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.editForm = {
      username: '',
      bio: '',
      profile_picture: null,
      banner_image: null
    };
  }

  saveProfile(): void {
    if (!this.user) return;

    const formData = new FormData();
    formData.append('username', this.editForm.username);
    formData.append('bio', this.editForm.bio);
    
    if (this.editForm.profile_picture) {
      formData.append('profile_picture', this.editForm.profile_picture);
    }
    if (this.editForm.banner_image) {
      formData.append('banner_image', this.editForm.banner_image);
    }

    this.userService.updateProfile(this.user.handle, formData).subscribe({
      next: (updatedUser) => {
        this.user = updatedUser;
        this.closeEditModal();
        this.notificationService.showSuccess('Profile updated successfully');
      },
      error: (error) => {
        console.error('Error updating profile:', error);
        this.notificationService.showError('Failed to update profile');
      }
    });
  }

  async followUser(): Promise<void> {
    if (!this.user || this.isFollowLoading) return;

    // If already following, show confirmation dialog
    if (this.user.is_following) {
      const dialogRef = this.dialog.open(UnfollowDialogComponent, {
        width: '400px',
        data: { handle: this.user.handle },
        panelClass: 'rounded-lg'
      });

      const result = await dialogRef.afterClosed().pipe(take(1)).toPromise();
      if (!result) return; // User cancelled
    }

    this.isFollowLoading = true;
    this.userService.followUser(this.user.handle).subscribe({
      next: (updatedUser) => {
        this.user = updatedUser;
        this.isFollowLoading = false;
      },
      error: (error) => {
        console.error('Error following user:', error);
        this.isFollowLoading = false;
        this.notificationService.showError('Failed to update follow status');
      }
    });
  }

  onPostClick(post: Post): void {
    this.router.navigate([`/${post.author.handle}/post/${post.id}`]);
  }

  onFollowButtonHover(isHovering: boolean): void {
    this.isHoveringFollowButton = isHovering;
  }

  showFollowers(event: Event): void {
    event.preventDefault();
    if (!this.user) return;

    this.userService.getUserFollowers(this.user.handle).subscribe(followers => {
      this.dialog.open(UserListDialogComponent, {
        data: {
          users: followers,
          title: 'Followers'
        },
        panelClass: 'rounded-lg'
      });
    });
  }

  showFollowing(event: Event): void {
    event.preventDefault();
    if (!this.user) return;

    this.userService.getUserFollowing(this.user.handle).subscribe(following => {
      this.dialog.open(UserListDialogComponent, {
        data: {
          users: following,
          title: 'Following'
        },
        panelClass: 'rounded-lg'
      });
    });
  }
} 