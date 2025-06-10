import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Post } from '../../models/post.model';
import { PostService } from '../../services/post.service';
import { AuthService } from '../../services/auth.service';
import { PostComponent } from '../shared/post/post.component';

@Component({
  selector: 'app-post-detail',
  standalone: true,
  imports: [CommonModule, PostComponent],
  template: `
    <div class="min-h-screen bg-gray-50 py-8">
      <div class="max-w-[598px] mx-auto">
        <!-- Loading State -->
        <div *ngIf="loading" class="flex justify-center items-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>

        <!-- Error State -->
        <div *ngIf="error" class="bg-red-50 text-red-500 p-4 rounded-lg text-center my-4">
          {{ error }}
        </div>

        <!-- Post Content -->
        <div *ngIf="post && !loading" class="bg-white rounded-lg shadow-sm overflow-hidden">
          <!-- Back Button -->
          <div class="p-4 border-b border-gray-100">
            <button (click)="goBack()" class="text-gray-500 hover:text-gray-700 flex items-center">
              <i class="fas fa-arrow-left mr-2"></i>
              Back
            </button>
          </div>

          <!-- Post with Comments -->
          <app-post
            [post]="post"
            [isDetailView]="true"
            [showComments]="true"
            (postUpdated)="onPostUpdated()">
          </app-post>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class PostDetailComponent implements OnInit {
  post: Post | null = null;
  loading = true;
  error: string | null = null;
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private postService: PostService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    const handle = this.route.snapshot.paramMap.get('handle');
    const postId = Number(this.route.snapshot.paramMap.get('id'));

    if (!handle || !postId) {
      this.error = 'Invalid post URL';
      this.loading = false;
      return;
    }

    this.postService.getPost(handle, postId).subscribe({
      next: (post) => {
        this.post = post;
        this.loading = false;
      },
      error: (error: Error) => {
        console.error('Error loading post:', error);
        this.error = 'Failed to load post';
        this.loading = false;
      }
    });
  }

  goBack(): void {
    const handle = this.post?.author.handle;
    if (handle) {
      this.router.navigate([`/${handle}`]);
    } else {
      this.router.navigate(['/']);
    }
  }

  toggleLike(): void {
    if (!this.post) return;

    const handle = this.post.author.handle;
    this.postService.likePost(handle, this.post.id).subscribe({
      next: () => {
        if (this.post) {
          this.post.is_liked = !this.post.is_liked;
          this.post.likes_count = (this.post.likes_count ?? 0) + (this.post.is_liked ? 1 : -1);
        }
      },
      error: (error: Error) => {
        console.error('Error toggling like:', error);
      }
    });
  }

  toggleBookmark(): void {
    if (!this.post) return;

    this.postService.bookmarkPost(this.post.author.handle, this.post.id).subscribe({
      next: (response) => {
        if (this.post) {
          this.post.is_bookmarked = !this.post.is_bookmarked;
        }
      },
      error: (error) => {
        console.error('Error toggling bookmark:', error);
      }
    });
  }

  onPostUpdated(): void {
    // Post is already updated via PostUpdateService
  }
} 