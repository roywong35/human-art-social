import { Component, OnInit, ViewChild, ElementRef, HostListener, CUSTOM_ELEMENTS_SCHEMA, NgModule, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Post } from '../../models/post.model';
import { PostService } from '../../services/post.service';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { PostComponent } from '../shared/post/post.component';
import { HumanArtPostComponent } from '../shared/human-art-post/human-art-post.component';
import { Router, ActivatedRoute } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { SubmitDrawingModalComponent } from '../submit-drawing-modal/submit-drawing-modal.component';
import { FormsModule } from '@angular/forms';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { PostInputBoxComponent } from '../shared/post-input-box/post-input-box.component';
import { PostUpdateService } from '../../services/post-update.service';
import { Subscription } from 'rxjs';
import { CommentDialogComponent } from '../comment-dialog/comment-dialog.component';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule, 
    PostComponent,
    HumanArtPostComponent,
    MatDialogModule,
    FormsModule,
    PostInputBoxComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit, OnDestroy {
  posts: Post[] = [];
  isInitialLoading = true;
  isLoadingMore = false;
  error: string | null = null;
  protected environment = environment;
  activeTab: 'for-you' | 'human-drawing' = 'for-you';
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  // Properties for post creation
  isSubmitting = false;
  private subscriptions = new Subscription();
  private scrollThrottleTimeout: any;

  constructor(
    private postService: PostService,
    public authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private cd: ChangeDetectorRef,
    private postUpdateService: PostUpdateService,
    private notificationService: NotificationService,
    private ngZone: NgZone
  ) {
    // Subscribe to route query params to detect tab changes
    this.subscriptions.add(
      this.route.queryParams.subscribe(params => {
        const newTab = params['tab'] === 'human-drawing' ? 'human-drawing' : 'for-you';
        if (this.activeTab !== newTab) {
          this.activeTab = newTab;
          this.loadPosts(true);
        }
      })
    );

    // Subscribe to posts$ stream for initial load and pagination
    this.subscriptions.add(
      this.postService.posts$.subscribe({
        next: (posts: Post[]) => {
          if (!posts) {
            console.warn('Received null posts');
            this.posts = [];
          } else {
            // Only replace posts on initial load or refresh
            if (this.isInitialLoading || !this.posts.length) {
              this.posts = posts;
            } else {
              // For infinite scroll, append new posts
              const newPosts = posts.filter(newPost => 
                !this.posts.some(existingPost => existingPost.id === newPost.id)
              );
              this.posts = [...this.posts, ...newPosts];
            }
          }
          this.isInitialLoading = false;
          this.isLoadingMore = false;
          this.cd.markForCheck();
        },
        error: (error: Error) => {
          console.error('Error loading posts:', error);
          this.error = 'Failed to load posts. Please try again.';
          this.posts = [];
          this.isInitialLoading = false;
          this.isLoadingMore = false;
          this.cd.markForCheck();
        }
      })
    );

    // Subscribe to post updates for real-time interactions
    this.subscriptions.add(
      this.postUpdateService.postUpdate$.subscribe(({ postId, updatedPost }) => {
        // Find all instances of the post (original and reposts)
        this.posts = this.posts.map(post => {
          if (post.id === postId) {
            // Update the post while preserving its position in the array
            return { ...post, ...updatedPost };
          }
          // Also update any referenced posts (for reposts)
          if (post.post_type === 'repost' && post.referenced_post?.id === postId) {
            return {
              ...post,
              referenced_post: { ...post.referenced_post, ...updatedPost }
            };
          }
          return post;
        });
        this.cd.markForCheck();
      })
    );
  }

  @HostListener('window:scroll', ['$event'])
  onScroll(): void {
    // Run scroll handling outside Angular zone for better performance
    this.ngZone.runOutsideAngular(() => {
      if (this.scrollThrottleTimeout) {
        return;
      }

      this.scrollThrottleTimeout = setTimeout(() => {
        const scrollPosition = window.innerHeight + window.scrollY;
        const scrollThreshold = document.documentElement.scrollHeight * 0.8;

        if (scrollPosition >= scrollThreshold && !this.isLoadingMore && this.postService.hasMorePosts) {
          // Run loadMorePosts inside Angular zone
          this.ngZone.run(() => {
            this.loadMorePosts();
          });
        }
        this.scrollThrottleTimeout = null;
      }, 200); // Increased throttle time to reduce sensitivity
    });
  }

  loadMorePosts(): void {
    if (!this.isLoadingMore && this.postService.hasMorePosts) {
      this.isLoadingMore = true;
      this.cd.markForCheck();
      this.postService.loadMorePosts();
    }
  }

  loadPosts(refresh: boolean = false): void {
    console.log('Loading posts for tab:', this.activeTab);
    this.error = null;
    this.isInitialLoading = refresh;
    this.cd.markForCheck();
    this.postService.loadPosts(refresh);
  }

  ngOnInit(): void {
    console.log('Home component initialized');
    // Get active tab from localStorage or route params
    this.route.queryParams.subscribe(params => {
      const tabFromParams = params['tab'];
      const savedTab = localStorage.getItem('activeTab');
      
      // Set active tab with priority: URL params > localStorage > default
      this.activeTab = tabFromParams || savedTab || 'for-you';
      localStorage.setItem('activeTab', this.activeTab);
      
      // Load posts for the active tab
      this.loadPosts(true);
    });
  }

  onPostUpdated(): void {
    // The post is already updated via the postUpdateService subscription
  }

  onLike(post: Post): void {
    // Optimistic UI update
    post.is_liked = !post.is_liked;
    post.likes_count = (post.likes_count || 0) + (post.is_liked ? 1 : -1);
    this.cd.markForCheck();

    // Backend call
    this.postService.likePost(post.author.handle, post.id).subscribe({
      error: (error) => {
        // Revert on error
        post.is_liked = !post.is_liked;
        post.likes_count = (post.likes_count || 0) + (post.is_liked ? 1 : -1);
        this.cd.markForCheck();
        console.error('Error liking post:', error);
        this.notificationService.showError('Failed to update like');
      }
    });
  }

  onComment(post: Post): void {
    const dialogRef = this.dialog.open(CommentDialogComponent, {
      width: '500px',
      data: { post }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Comment was added, refresh the post
        const handle = post.author.handle;
        this.postService.getPost(handle, post.id).subscribe({
          next: (updatedPost) => {
            const index = this.posts.findIndex(p => p.id === post.id);
            if (index !== -1) {
              this.posts[index] = updatedPost;
            }
          },
          error: (error: Error) => console.error('Error refreshing post:', error)
        });
      }
    });
  }

  onRepost(post: Post): void {
    // Optimistic UI update
    post.is_reposted = !post.is_reposted;
    post.reposts_count = (post.reposts_count || 0) + (post.is_reposted ? 1 : -1);
    this.cd.markForCheck();

    // Backend call
    this.postService.repost(post.author.handle, post.id).subscribe({
      next: (response) => {
        // Update with full server response to ensure consistency
        const index = this.posts.findIndex(p => p.id === post.id);
        if (index !== -1) {
          this.posts[index] = response;
          this.cd.markForCheck();
        }
      },
      error: (error) => {
        // Revert on error
        post.is_reposted = !post.is_reposted;
        post.reposts_count = (post.reposts_count || 0) + (post.is_reposted ? 1 : -1);
        this.cd.markForCheck();
        console.error('Error reposting:', error);
        this.notificationService.showError('Failed to repost');
      }
    });
  }

  onBookmark(post: Post): void {
    // Optimistic UI update
    post.is_bookmarked = !post.is_bookmarked;
    this.cd.markForCheck();

    // Backend call
    this.postService.bookmarkPost(post.author.handle, post.id).subscribe({
      error: (error) => {
        // Revert on error
        post.is_bookmarked = !post.is_bookmarked;
        this.cd.markForCheck();
        console.error('Error bookmarking post:', error);
        this.notificationService.showError('Failed to update bookmark');
      }
    });
  }

  onShare(post: Post): void {
    const url = `${window.location.origin}/${post.author.handle}/post/${post.id}`;
    navigator.clipboard.writeText(url).then(() => {
      this.notificationService.showSuccess('Post link copied to clipboard');
    }).catch((error: Error) => {
      this.notificationService.showError('Failed to copy link to clipboard');
      console.error('Error copying to clipboard:', error);
    });
  }

  onImageError(event: any): void {
    console.error('Image failed to load:', event.target.src);
    // Optionally set a fallback image
    event.target.src = 'assets/image-placeholder.png';
  }

  openPost(post: Post): void {
    // Navigate to the post detail view
    const handle = post.author.handle;
    this.router.navigate([`/${handle}/post`, post.id]);
  }

  protected onImageSelected(event: any): void {
    const file = event instanceof File ? event : event.target?.files?.[0];
    if (!file) return;

    this.postService.createPost('', [file]).subscribe({
      error: (error) => {
        console.error('Error creating post:', error);
      }
    });
  }

  protected onPostSubmit(data: { content: string, images?: File[] }): void {
    this.isSubmitting = true;
    this.postService.createPost(data.content, data.images).subscribe({
      error: (error) => {
        console.error('Error creating post:', error);
      },
      complete: () => {
        this.isSubmitting = false;
      }
    });
  }

  onPostDeleted(postId: number): void {
    this.posts = this.posts.filter(post => post.id !== postId);
  }

  setActiveTab(tab: 'for-you' | 'human-drawing'): void {
    if (this.activeTab !== tab) {
      this.activeTab = tab;
      localStorage.setItem('activeTab', tab);
      
      // Update URL without triggering the router subscription
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { tab: tab === 'for-you' ? null : tab },
        queryParamsHandling: 'merge',
        replaceUrl: true
      });

      // Reload posts for the new tab
      this.loadPosts();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.scrollThrottleTimeout) {
      clearTimeout(this.scrollThrottleTimeout);
    }
  }
} 