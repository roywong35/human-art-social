import { Component, OnInit, OnDestroy, Inject, ChangeDetectorRef, HostListener, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ActivatedRoute, Router } from '@angular/router';
import { User } from '../../../models/user.model';
import { Post } from '../../../models/post.model';
import { UserService } from '../../../services/user.service';
import { PostService } from '../../../services/post.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { PostComponent } from '../../features/posts/post/post.component';
import { take } from 'rxjs/operators';
import { MatDialog, MatDialogModule} from '@angular/material/dialog';
import { UserListDialogComponent } from '../../dialogs/user-list-dialog/user-list-dialog.component';
import { Subscription } from 'rxjs';
import { UnfollowDialogComponent } from '../../dialogs/unfollow-dialogs/unfollow-dialog.component';


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
  private userPostsSubscription: Subscription | undefined;
  private subscriptions = new Subscription();
  user: User | null = null;
  posts: Post[] = [];
  replies: Post[] = [];
  replyParentChains: { [replyId: number]: Post[] } = {};
  mediaItems: { image: string; postId: number }[] = [];
  humanArtPosts: Post[] = [];
  likedPosts: Post[] = [];
  activeTab: 'posts' | 'replies' | 'media' | 'human-art' | 'likes' = 'posts';
  isLoading = true;
  isLoadingPosts = false;
  isLoadingMorePosts = false;
  isLoadingReplies = false;
  isLoadingMoreReplies = false;
  isLoadingMedia = false;
  isLoadingHumanArt = false;
  isLoadingLikes = false;
  error: string | null = null;
  isCurrentUser = false;
  showEditModal = false;
  isFollowLoading = false;
  isHoveringFollowButton = false;
  private scrollThrottleTimeout: any;
  private currentHandle: string | null = null;
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
    public postService: PostService,
    private toastService: ToastService,
    private authService: AuthService,
    private dialog: MatDialog,
    private cd: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    // Subscribe to user posts stream just like homepage - in constructor
    this.subscriptions.add(
      this.postService.userPosts$.subscribe({
        next: (posts: Post[]) => {

          if (!posts) {
            this.posts = [];
          } else {
            // Always replace posts array to ensure change detection
            this.posts = [...posts];
          }
          
          this.isLoadingPosts = false;
          this.isLoadingMorePosts = false;
          this.cd.markForCheck();
        },
        error: (error: Error) => {
          console.error('Error loading posts:', error);
          this.error = 'Failed to load posts';
          this.posts = [];
          this.isLoadingPosts = false;
          this.isLoadingMorePosts = false;
          this.cd.markForCheck();
        }
      })
    );

    // Subscribe to user replies stream just like posts
    this.subscriptions.add(
      this.postService.userReplies$.subscribe({
        next: async (replies: Post[]) => {

          if (!replies) {
            this.replies = [];
          } else {
            // Always replace replies array to ensure change detection
            this.replies = [...replies];
            
            // Build parent chains only for newly received replies (much faster!)
            for (const reply of this.replies) {
              if (!this.replyParentChains[reply.id]) {
                await this.buildParentChain(reply);
              }
            }
          }
          
          this.isLoadingReplies = false;
          this.isLoadingMoreReplies = false;
          this.cd.markForCheck();
        },
        error: (error: Error) => {
          console.error('Error loading replies:', error);
          this.error = 'Failed to load replies';
          this.replies = [];
          this.isLoadingReplies = false;
          this.isLoadingMoreReplies = false;
          this.cd.markForCheck();
        }
      })
    );
  }

  ngOnInit(): void {
    // Subscribe to route parameter changes
    this.routeSubscription = this.route.paramMap.subscribe(params => {
      const handle = params.get('handle');

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
        
        // Set appropriate loading state for the tab
        switch (this.activeTab) {
          case 'posts':
            this.isLoadingPosts = true;
            break;
          case 'replies':
            this.isLoadingReplies = true;
            break;
          case 'media':
            this.isLoadingMedia = true;
            break;
          case 'human-art':
            this.isLoadingHumanArt = true;
            break;
          case 'likes':
            this.isLoadingLikes = true;
            break;
        }
        
        this.loadTabContent(this.user?.handle || '');
      }
    });
  }

  @HostListener('window:scroll', ['$event'])
  onWindowScroll(): void {
    // Only trigger pagination for posts and replies tabs
    if (this.activeTab !== 'posts' && this.activeTab !== 'replies') return;

    // Throttle scroll events
    if (this.scrollThrottleTimeout) return;

    this.scrollThrottleTimeout = setTimeout(() => {
      const scrollPosition = window.innerHeight + window.scrollY;
      const scrollThreshold = document.documentElement.scrollHeight * 0.8;

      if (this.activeTab === 'posts') {
        if (scrollPosition >= scrollThreshold && !this.isLoadingMorePosts && this.postService.hasMoreUserPosts) {

          this.ngZone.run(() => {
            this.loadMorePosts();
          });
        }
      } else if (this.activeTab === 'replies') {
        if (scrollPosition >= scrollThreshold && !this.isLoadingMoreReplies && this.postService.hasMoreUserReplies) {

          this.ngZone.run(() => {
            this.loadMoreReplies();
          });
        }
      }

      this.scrollThrottleTimeout = null;
    }, 200);
  }

  loadMorePosts(): void {
    if (!this.isLoadingMorePosts && this.postService.hasMoreUserPosts) {

      this.isLoadingMorePosts = true;
      this.cd.markForCheck();
      this.postService.loadMoreUserPosts();
    }
  }

  loadMoreReplies(): void {
    if (!this.isLoadingMoreReplies && this.postService.hasMoreUserReplies) {

      this.isLoadingMoreReplies = true;
      this.cd.markForCheck();
      this.postService.loadMoreUserReplies();
    }
  }

  ngOnDestroy(): void {
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
    if (this.userPostsSubscription) {
      this.userPostsSubscription.unsubscribe();
    }
    this.subscriptions.unsubscribe();
    if (this.scrollThrottleTimeout) {
      clearTimeout(this.scrollThrottleTimeout);
    }
    // Clear user posts and replies when leaving profile
    this.postService.clearUserPosts();
    this.postService.clearUserReplies();
  }

  private loadUserProfile(handle: string): void {

    this.userService.getUserByHandle(handle).subscribe({
      next: (user) => {

        this.user = user;
        // Profile info is loaded, but tab content might still be loading
        this.isLoading = false;
        // Subscribe to auth changes to update isCurrentUser reactively
        this.authService.currentUser$.subscribe(currentUser => {
          this.isCurrentUser = currentUser?.id === user.id;
          this.cd.detectChanges(); // Update view when auth state changes
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
    
    // Set appropriate loading state for the tab
    switch (tab) {
      case 'posts':
        this.isLoadingPosts = true;
        break;
      case 'replies':
        this.isLoadingReplies = true;
        break;
      case 'media':
        this.isLoadingMedia = true;
        break;
      case 'human-art':
        this.isLoadingHumanArt = true;
        break;
      case 'likes':
        this.isLoadingLikes = true;
        break;
    }
    
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
    // Set loading state like homepage
    this.isLoadingPosts = true;
    this.error = null;
    
    // Only clear posts if switching users
    if (this.currentHandle !== handle) {
      this.posts = [];
    }
    
    this.currentHandle = handle;

    
    // Just trigger the load - we're already subscribed to userPosts$ in constructor
    this.postService.getUserPosts(handle, true); // true = refresh
  }

  private loadUserReplies(handle: string): void {
    this.isLoadingReplies = true;
    this.error = null;
    
    // Only clear replies if switching users
    if (this.currentHandle !== handle) {
      this.replies = [];
    }
    

    
    // Just trigger the load - we're already subscribed to userReplies$ in constructor
    this.postService.getUserReplies(handle, true); // true = refresh
  }

  private async buildParentChain(reply: Post) {

    
    // Initialize empty chain for this reply
    this.replyParentChains[reply.id] = [];

    // Use conversation_chain to build the parent chain
    if (reply.conversation_chain && reply.conversation_chain.length > 0) {
      // Get all posts except the last one (which is the current reply)
      const chainIds = reply.conversation_chain.slice(0, -1);

      
      for (const postId of chainIds) {
        try {
          // Use getPostById since parent posts can be from different users
          const chainPost = await this.postService.getPostById(postId).toPromise();
          if (chainPost) {

            this.replyParentChains[reply.id].push(chainPost);
          }
        } catch (error) {
          console.error(`Error loading parent post ${postId}:`, error);
        }
      }
    }


  }

  private loadUserMedia(handle: string): void {
    this.isLoadingMedia = true;
    this.error = null;
    
    this.postService.getUserMedia(handle).subscribe({
      next: (posts: Post[]) => {
        this.mediaItems = posts.reduce((acc: { image: string; postId: number }[], post: Post) => {
          const images = post.images?.map(img => ({
            image: img.image,
            postId: post.id
          })) || [];
          return [...acc, ...images];
        }, []);
        this.isLoadingMedia = false;
        this.cd.markForCheck();
      },
      error: (error: Error) => {
        console.error('Error loading media:', error);
        this.error = 'Failed to load media';
        this.isLoadingMedia = false;
        this.cd.markForCheck();
      }
    });
  }

  private loadUserHumanArt(handle: string): void {
    this.isLoadingHumanArt = true;
    this.error = null;
    
    this.postService.getUserHumanArt(handle).subscribe({
      next: (posts: Post[]) => {
        this.humanArtPosts = posts.filter(post => post.is_verified);
        this.isLoadingHumanArt = false;
        this.cd.markForCheck();
      },
      error: (error: Error) => {
        console.error('Error loading human art:', error);
        this.error = 'Failed to load human art';
        this.isLoadingHumanArt = false;
        this.cd.markForCheck();
      }
    });
  }

  private loadUserLikes(handle: string): void {
    this.isLoadingLikes = true;
    this.error = null;
    
    this.postService.getUserLikes(handle).subscribe({
      next: (posts: Post[]) => {
        this.likedPosts = posts;
        this.isLoadingLikes = false;
        this.cd.markForCheck();
      },
      error: (error: Error) => {
        console.error('Error loading likes:', error);
        this.error = 'Failed to load likes';
        this.isLoadingLikes = false;
        this.cd.markForCheck();
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

  onPostUpdated(updatedPost: Post): void {
    this.ngZone.run(() => {
      // Update posts array
      this.posts = this.posts.map(post => {
        if (post.id === updatedPost.id) {
          return { ...post, replies_count: updatedPost.replies_count };
        }
        if (post.post_type === 'repost' && post.referenced_post?.id === updatedPost.id) {
          return {
            ...post,
            referenced_post: { ...post.referenced_post, replies_count: updatedPost.replies_count }
          };
        }
        return post;
      });

      // Update replies array
      this.replies = this.replies.map(post => {
        if (post.id === updatedPost.id) {
          return { ...post, replies_count: updatedPost.replies_count };
        }
        if (post.post_type === 'repost' && post.referenced_post?.id === updatedPost.id) {
          return {
            ...post,
            referenced_post: { ...post.referenced_post, replies_count: updatedPost.replies_count }
          };
        }
        return post;
      });

      // Update liked posts array
      this.likedPosts = this.likedPosts.map(post => {
        if (post.id === updatedPost.id) {
          return { ...post, replies_count: updatedPost.replies_count };
        }
        if (post.post_type === 'repost' && post.referenced_post?.id === updatedPost.id) {
          return {
            ...post,
            referenced_post: { ...post.referenced_post, replies_count: updatedPost.replies_count }
          };
        }
        return post;
      });

      this.cd.markForCheck();
    });
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

  onPostReported(postId: number): void {
    // Remove the reported post from all relevant arrays
    this.posts = this.posts.filter(post => post.id !== postId);
    this.replies = this.replies.filter(post => post.id !== postId);
    this.likedPosts = this.likedPosts.filter(post => post.id !== postId);
    this.humanArtPosts = this.humanArtPosts.filter(post => post.id !== postId);
    
    // Remove from media items as well
    this.mediaItems = this.mediaItems.filter(item => item.postId !== postId);
  }

  onLike(post: Post): void {
    const originalPost = post.post_type === 'repost' ? post.referenced_post! : post;
    const newLikeState = !originalPost.is_liked;
    const newCount = originalPost.likes_count + (newLikeState ? 1 : -1);

    this.ngZone.run(() => {
      // Update posts array
      this.posts.forEach(p => {
        if (p.id === originalPost.id) {
          p.is_liked = newLikeState;
          p.likes_count = newCount;
        }
        if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
          p.referenced_post.is_liked = newLikeState;
          p.referenced_post.likes_count = newCount;
        }
      });

      // Update replies array
      this.replies.forEach(p => {
        if (p.id === originalPost.id) {
          p.is_liked = newLikeState;
          p.likes_count = newCount;
        }
        if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
          p.referenced_post.is_liked = newLikeState;
          p.referenced_post.likes_count = newCount;
        }
      });

      // Update liked posts array
      this.likedPosts.forEach(p => {
        if (p.id === originalPost.id) {
          p.is_liked = newLikeState;
          p.likes_count = newCount;
        }
        if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
          p.referenced_post.is_liked = newLikeState;
          p.referenced_post.likes_count = newCount;
        }
      });

      this.cd.markForCheck();
    });

    // Backend call
    this.postService.likePost(originalPost.author.handle, originalPost.id).subscribe({
      error: (error) => {
        this.ngZone.run(() => {
          // Revert changes on error
          this.posts.forEach(p => {
            if (p.id === originalPost.id) {
              p.is_liked = !newLikeState;
              p.likes_count = originalPost.likes_count;
            }
            if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
              p.referenced_post.is_liked = !newLikeState;
              p.referenced_post.likes_count = originalPost.likes_count;
            }
          });

          this.replies.forEach(p => {
            if (p.id === originalPost.id) {
              p.is_liked = !newLikeState;
              p.likes_count = originalPost.likes_count;
            }
            if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
              p.referenced_post.is_liked = !newLikeState;
              p.referenced_post.likes_count = originalPost.likes_count;
            }
          });

          this.likedPosts.forEach(p => {
            if (p.id === originalPost.id) {
              p.is_liked = !newLikeState;
              p.likes_count = originalPost.likes_count;
            }
            if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
              p.referenced_post.is_liked = !newLikeState;
              p.referenced_post.likes_count = originalPost.likes_count;
            }
          });

          this.cd.markForCheck();
        });
        console.error('Error liking post:', error);
        this.toastService.showError('Failed to update like');
      }
    });
  }

  onRepost(post: Post): void {
    const originalPost = post.post_type === 'repost' ? post.referenced_post! : post;
    const newRepostState = !originalPost.is_reposted;
    const newCount = originalPost.reposts_count + (newRepostState ? 1 : -1);

    this.ngZone.run(() => {
      // Update posts array
      this.posts.forEach(p => {
        if (p.id === originalPost.id) {
          p.is_reposted = newRepostState;
          p.reposts_count = newCount;
        }
        if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
          p.referenced_post.is_reposted = newRepostState;
          p.referenced_post.reposts_count = newCount;
        }
      });

      // Update replies array
      this.replies.forEach(p => {
        if (p.id === originalPost.id) {
          p.is_reposted = newRepostState;
          p.reposts_count = newCount;
        }
        if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
          p.referenced_post.is_reposted = newRepostState;
          p.referenced_post.reposts_count = newCount;
        }
      });

      // Update liked posts array
      this.likedPosts.forEach(p => {
        if (p.id === originalPost.id) {
          p.is_reposted = newRepostState;
          p.reposts_count = newCount;
        }
        if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
          p.referenced_post.is_reposted = newRepostState;
          p.referenced_post.reposts_count = newCount;
        }
      });

      this.cd.markForCheck();
    });

    // Backend call
    this.postService.repostPost(originalPost.author.handle, originalPost.id.toString()).subscribe({
      error: (error) => {
        this.ngZone.run(() => {
          // Revert changes on error
          this.posts.forEach(p => {
            if (p.id === originalPost.id) {
              p.is_reposted = !newRepostState;
              p.reposts_count = originalPost.reposts_count;
            }
            if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
              p.referenced_post.is_reposted = !newRepostState;
              p.referenced_post.reposts_count = originalPost.reposts_count;
            }
          });

          this.replies.forEach(p => {
            if (p.id === originalPost.id) {
              p.is_reposted = !newRepostState;
              p.reposts_count = originalPost.reposts_count;
            }
            if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
              p.referenced_post.is_reposted = !newRepostState;
              p.referenced_post.reposts_count = originalPost.reposts_count;
            }
          });

          this.likedPosts.forEach(p => {
            if (p.id === originalPost.id) {
              p.is_reposted = !newRepostState;
              p.reposts_count = originalPost.reposts_count;
            }
            if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
              p.referenced_post.is_reposted = !newRepostState;
              p.referenced_post.reposts_count = originalPost.reposts_count;
            }
          });

          this.cd.markForCheck();
        });
        console.error('Error reposting:', error);
        this.toastService.showError('Failed to repost');
      }
    });
  }

  onBookmark(post: Post): void {
    const originalPost = post.post_type === 'repost' ? post.referenced_post! : post;
    const newBookmarkState = !originalPost.is_bookmarked;

    this.ngZone.run(() => {
      // Update posts array
      this.posts.forEach(p => {
        if (p.id === originalPost.id) {
          p.is_bookmarked = newBookmarkState;
        }
        if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
          p.referenced_post.is_bookmarked = newBookmarkState;
        }
      });

      // Update replies array
      this.replies.forEach(p => {
        if (p.id === originalPost.id) {
          p.is_bookmarked = newBookmarkState;
        }
        if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
          p.referenced_post.is_bookmarked = newBookmarkState;
        }
      });

      // Update liked posts array
      this.likedPosts.forEach(p => {
        if (p.id === originalPost.id) {
          p.is_bookmarked = newBookmarkState;
        }
        if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
          p.referenced_post.is_bookmarked = newBookmarkState;
        }
      });

      this.cd.markForCheck();
    });

    // Backend call
    this.postService.bookmarkPost(originalPost.author.handle, originalPost.id).subscribe({
      error: (error) => {
        this.ngZone.run(() => {
          // Revert changes on error
          this.posts.forEach(p => {
            if (p.id === originalPost.id) {
              p.is_bookmarked = !newBookmarkState;
            }
            if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
              p.referenced_post.is_bookmarked = !newBookmarkState;
            }
          });

          this.replies.forEach(p => {
            if (p.id === originalPost.id) {
              p.is_bookmarked = !newBookmarkState;
            }
            if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
              p.referenced_post.is_bookmarked = !newBookmarkState;
            }
          });

          this.likedPosts.forEach(p => {
            if (p.id === originalPost.id) {
              p.is_bookmarked = !newBookmarkState;
            }
            if (p.post_type === 'repost' && p.referenced_post?.id === originalPost.id) {
              p.referenced_post.is_bookmarked = !newBookmarkState;
            }
          });

          this.cd.markForCheck();
        });
        console.error('Error bookmarking post:', error);
        this.toastService.showError('Failed to update bookmark');
      }
    });
  }
} 