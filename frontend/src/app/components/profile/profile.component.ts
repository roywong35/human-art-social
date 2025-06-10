import { Component, OnInit } from '@angular/core';
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

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PostComponent],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  user: User | null = null;
  posts: Post[] = [];
  isLoading = true;
  error: string | null = null;
  isCurrentUser = false;
  showEditModal = false;
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
  ) {}

  ngOnInit(): void {
    const handle = this.route.snapshot.paramMap.get('handle');
    if (!handle) {
      this.error = 'Invalid profile URL';
      this.isLoading = false;
      return;
    }

    this.loadUserProfile(handle);
  }

  private loadUserProfile(handle: string): void {
    this.userService.getUserByHandle(handle).subscribe({
      next: (user) => {
        this.user = user;
        this.authService.currentUser$.pipe(take(1)).subscribe(currentUser => {
          this.isCurrentUser = currentUser?.id === user.id;
        });
        this.loadUserPosts(handle);
      },
      error: (error) => {
        console.error('Error loading profile:', error);
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

    this.userService.updateProfile(this.user.id, formData).subscribe({
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

  followUser(): void {
    if (!this.user) return;

    this.userService.followUser(this.user.id).subscribe({
      next: (updatedUser) => {
        this.user = updatedUser;
      },
      error: (error) => {
        console.error('Error following user:', error);
        this.notificationService.showError('Failed to follow user');
      }
    });
  }

  onPostClick(post: Post): void {
    this.router.navigate([`/${post.author.handle}/post/${post.id}`]);
  }
} 