import { Component, OnInit, ViewChild, ElementRef, HostListener, CUSTOM_ELEMENTS_SCHEMA, NgModule, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Post } from '../../models/post.model';
import { PostService } from '../../services/post.service';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { PostComponent } from '../shared/post/post.component';
import { InstagramStylePostComponent } from '../instagram-style-post/instagram-style-post.component';
import { Router, ActivatedRoute } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { SubmitDrawingModalComponent } from '../submit-drawing-modal/submit-drawing-modal.component';
import { FormsModule } from '@angular/forms';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { PostInputBoxComponent } from '../shared/post-input-box/post-input-box.component';
import { PostUpdateService } from '../../services/post-update.service';
import { Subscription } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { CommentDialogComponent } from '../comment-dialog/comment-dialog.component';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule, 
    PostComponent, 
    InstagramStylePostComponent,
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
  isLoading = true;
  error: string | null = null;
  protected environment = environment;
  activeTab: 'for-you' | 'human-drawing' = 'for-you';
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  // Properties for post creation
  isSubmitting = false;
  private subscriptions = new Subscription();

  constructor(
    private postService: PostService,
    public authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private cd: ChangeDetectorRef,
    private postUpdateService: PostUpdateService,
    private notificationService: NotificationService
  ) {
    // Subscribe to route query params to detect tab changes
    this.subscriptions.add(
      this.route.queryParams.pipe(
        distinctUntilChanged()
      ).subscribe(params => {
        const newTab = params['tab'] === 'human-drawing' ? 'human-drawing' : 'for-you';
        if (this.activeTab !== newTab) {
          this.activeTab = newTab;
          this.loadPosts();
        }
      })
    );

    // Subscribe to post updates
    this.subscriptions.add(
      this.postUpdateService.postUpdate$.pipe(
        distinctUntilChanged((prev, curr) => prev.postId === curr.postId)
      ).subscribe(({ postId, updatedPost }) => {
        this.posts = this.posts.map(post => {
          if (post.id === postId) {
            return { ...post, ...updatedPost };
          }
          if (post.post_type === 'repost' && post.referenced_post && post.referenced_post.id === postId) {
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

    // Subscribe to posts stream
    this.subscriptions.add(
      this.postService.posts$.pipe(
        distinctUntilChanged((prev, curr) => 
          JSON.stringify(prev) === JSON.stringify(curr)
        )
      ).subscribe({
        next: (posts: Post[]) => {
          this.posts = [...posts];
          this.isLoading = false;
          this.cd.markForCheck();
        },
        error: (error: Error) => {
          console.error('Error loading posts:', error);
          this.error = 'Failed to load posts. Please try again.';
          this.isLoading = false;
          this.cd.markForCheck();
        }
      })
    );
  }

  ngOnInit(): void {
    this.loadPosts();
  }

  loadPosts(): void {
    this.isLoading = true;
    this.error = null;
    this.cd.markForCheck();
    this.postService.loadPosts();
  }

  onPostUpdated(): void {
    // The post is already updated via the postUpdateService subscription
  }

  onLike(post: Post): void {
    this.postService.likePost(post.author.handle, post.id).subscribe({
      next: () => {
        post.is_liked = !post.is_liked;
        post.likes_count = (post.likes_count || 0) + (post.is_liked ? 1 : -1);
      },
      error: (error) => console.error('Error liking post:', error)
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
    this.postService.repost(post.author.handle, post.id).subscribe({
      next: (response) => {
        const index = this.posts.findIndex(p => p.id === post.id);
        if (index !== -1) {
          this.posts[index] = response;
        }
      },
      error: (error) => console.error('Error reposting:', error)
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

    this.postService.createPost('', file).subscribe({
      next: (post) => {
        this.posts.unshift(post);
      },
      error: (error) => {
        console.error('Error creating post:', error);
      }
    });
  }

  protected onPostSubmit(data: { content: string, image?: File }): void {
    this.isSubmitting = true;
    this.postService.createPost(data.content, data.image ? [data.image] : undefined).subscribe({
      next: (post) => {
        this.posts.unshift(post);
      },
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
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { tab: tab === 'for-you' ? null : tab },
        queryParamsHandling: 'merge'
      });
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
} 