import { Component, OnInit, ViewChild, ElementRef, HostListener, CUSTOM_ELEMENTS_SCHEMA, NgModule, OnDestroy } from '@angular/core';
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
import { ChangeDetectorRef } from '@angular/core';
import { PostInputBoxComponent } from '../shared/post-input-box/post-input-box.component';
import { PostUpdateService } from '../../services/post-update.service';
import { Subscription } from 'rxjs';
import { CommentDialogComponent } from '../comment-dialog/comment-dialog.component';

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
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
  posts: Post[] = [];
  loading = true;
  error: string | null = null;
  protected environment = environment;
  activeTab: 'for-you' | 'human-drawing' = 'for-you';
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  // Properties for post creation
  isSubmitting = false;
  private postUpdateSubscription: Subscription;

  constructor(
    private postService: PostService,
    public authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private cd: ChangeDetectorRef,
    private postUpdateService: PostUpdateService
  ) {
    // Subscribe to route query params to detect tab changes
    this.route.queryParams.subscribe(params => {
      const newTab = params['tab'] === 'human-drawing' ? 'human-drawing' : 'for-you';
      if (this.activeTab !== newTab) {
        this.activeTab = newTab;
        this.loadPosts();
      }
    });

    // Listen for custom tab change events
    window.addEventListener('tabChanged', ((event: CustomEvent) => {
      if (event.detail === 'for-you' && this.activeTab !== 'for-you') {
        this.activeTab = 'for-you';
        this.loadPosts();
      }
    }) as EventListener);

    this.postUpdateSubscription = this.postUpdateService.postUpdate$.subscribe(
      ({ postId, updatedPost }) => {
        // Update all instances of the post in the timeline
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
      }
    );
  }

  ngOnInit(): void {
    // Check for tab parameter in URL
    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'human-drawing') {
        this.activeTab = 'human-drawing';
      }
      this.loadPosts();
    });
  }

  setActiveTab(tab: 'for-you' | 'human-drawing'): void {
    if (this.activeTab !== tab) {
      this.activeTab = tab;
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { tab: tab === 'for-you' ? 'for-you' : 'human-drawing' },
        queryParamsHandling: 'merge'
      }).then(() => {
        this.loadPosts();
      });
    }
  }

  loadPosts(): void {
    this.loading = true;
    this.error = null;

    this.postService.getPosts().subscribe({
      next: (posts) => {
        if (this.activeTab === 'for-you') {
          // Show all posts in For You tab
          this.posts = posts;
        } else {
          // Show only verified human art in Human Art tab
          this.posts = posts.filter(post => 
            post.is_human_drawing && post.is_verified
          );
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading posts:', error);
        this.error = 'Failed to load posts. Please try again.';
        this.loading = false;
      }
    });
  }

  onPostUpdated(): void {
    // The post is already updated via the postUpdateService subscription
  }

  onLike(post: Post): void {
    // TODO: Implement like functionality
    console.log('Like post:', post);
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
      // TODO: Add toast notification
      console.log('Post URL copied to clipboard');
    }).catch((error: Error) => {
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
    this.postService.createPost(data.content, data.image).subscribe({
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

  ngOnDestroy(): void {
    if (this.postUpdateSubscription) {
      this.postUpdateSubscription.unsubscribe();
    }
  }
} 