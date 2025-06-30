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
import { ToastService } from '../../services/toast.service';
import { PostComponent } from '../shared/post/post.component';
import { take } from 'rxjs/operators';
import { MatDialog, MatDialogModule} from '@angular/material/dialog';
import { UserListDialogComponent } from '../shared/user-list-dialog/user-list-dialog.component';
import { Subscription } from 'rxjs';
import { UnfollowDialogComponent } from '../unfollow-dialogs/unfollow-dialog.component';


@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    RouterModule, 
    PostComponent, 
    MatDialogModule
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit, OnDestroy {
  private routeSubscription: Subscription | undefined;
  user: User | null = null;
  posts: Post[] = [];
  replies: Post[] = [];
  replyParentChains: { [replyId: number]: Post[] } = {};
  mediaItems: { image: string; postId: number }[] = [];
  humanArtPosts: Post[] = [];
  likedPosts: Post[] = [];
  activeTab: 'posts' | 'replies' | 'media' | 'human-art' | 'likes' = 'posts';
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
    private toastService: ToastService,
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
      this.replies = [];
      this.replyParentChains = {};
      this.mediaItems = [];
      this.humanArtPosts = [];
      this.likedPosts = [];

      this.loadUserProfile(handle);
    });

    // Subscribe to query params for tab
    this.route.queryParams.subscribe(params => {
      const tab = params['tab'];
      if (tab && ['posts', 'replies', 'media', 'human-art', 'likes'].includes(tab)) {
        this.activeTab = tab as 'posts' | 'replies' | 'media' | 'human-art' | 'likes';
        this.loadTabContent(this.user?.handle || '');
      }
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
        this.loadTabContent(handle);
      },
      error: (error) => {
        console.error('ProfileComponent: Error loading profile:', error);
        this.error = 'Failed to load profile';
        this.isLoading = false;
      }
    });
  }

  setActiveTab(tab: 'posts' | 'replies' | 'media' | 'human-art' | 'likes'): void {
    this.activeTab = tab;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge'
    });
    this.loadTabContent(this.user?.handle || '');
  }

  private loadTabContent(handle: string): void {
    if (!handle) return;

    switch (this.activeTab) {
      case 'posts':
        this.loadUserPosts(handle);
        break;
      case 'replies':
        this.loadUserReplies(handle);
        break;
      case 'media':
        this.loadUserMedia(handle);
        break;
      case 'human-art':
        this.loadUserHumanArt(handle);
        break;
      case 'likes':
        this.loadUserLikes(handle);
        break;
    }
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

  private loadUserReplies(handle: string): void {
    this.postService.getUserReplies(handle).subscribe({
      next: async (replies) => {
        // Filter to ensure we only have replies
        this.replies = replies.filter(post => post.post_type === 'reply');
        
        // Build parent chains for each reply
        for (const reply of this.replies) {
          await this.buildParentChain(reply);
        }
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading user replies:', error);
        this.error = 'Failed to load replies';
        this.isLoading = false;
      }
    });
  }

  private async buildParentChain(reply: Post) {
    console.log('Building parent chain for reply:', reply.id);
    
    // Initialize empty chain for this reply
    this.replyParentChains[reply.id] = [];

    // Use conversation_chain to build the parent chain
    if (reply.conversation_chain && reply.conversation_chain.length > 0) {
      // Get all posts except the last one (which is the current reply)
      const chainIds = reply.conversation_chain.slice(0, -1);
      console.log('Using conversation chain:', chainIds);
      
      for (const postId of chainIds) {
        try {
          // Use getPostById since parent posts can be from different users
          const chainPost = await this.postService.getPostById(postId).toPromise();
          if (chainPost) {
            console.log('Added parent to chain:', chainPost.id);
            this.replyParentChains[reply.id].push(chainPost);
          }
        } catch (error) {
          console.error(`Error loading parent post ${postId}:`, error);
        }
      }
    }

    console.log('Final parent chain for reply', reply.id, ':', this.replyParentChains[reply.id].map(p => p.id));
  }

  private loadUserMedia(handle: string): void {
    this.postService.getUserMedia(handle).subscribe({
      next: (posts: Post[]) => {
        this.mediaItems = posts.reduce((acc: { image: string; postId: number }[], post: Post) => {
          const images = post.images?.map(img => ({
            image: img.image,
            postId: post.id
          })) || [];
          return [...acc, ...images];
        }, []);
        this.isLoading = false;
      },
      error: (error: Error) => {
        console.error('Error loading media:', error);
        this.error = 'Failed to load media';
        this.isLoading = false;
      }
    });
  }

  private loadUserHumanArt(handle: string): void {
    this.postService.getUserHumanArt(handle).subscribe({
      next: (posts: Post[]) => {
        this.humanArtPosts = posts.filter(post => post.is_verified);
        this.isLoading = false;
      },
      error: (error: Error) => {
        console.error('Error loading human art:', error);
        this.error = 'Failed to load human art';
        this.isLoading = false;
      }
    });
  }

  private loadUserLikes(handle: string): void {
    this.postService.getUserLikes(handle).subscribe({
      next: (posts: Post[]) => {
        this.likedPosts = posts;
        this.isLoading = false;
      },
      error: (error: Error) => {
        console.error('Error loading likes:', error);
        this.error = 'Failed to load likes';
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
        this.toastService.showSuccess('Profile updated successfully');
      },
      error: (error) => {
        console.error('Error updating profile:', error);
        this.toastService.showError('Failed to update profile');
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
        this.toastService.showError('Failed to update follow status');
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

  onMediaClick(media: { image: string; postId: number }): void {
    this.router.navigate(['/', this.user?.handle, 'post', media.postId]);
  }
} 