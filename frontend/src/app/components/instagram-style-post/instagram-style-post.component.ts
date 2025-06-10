import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Post } from '../../models/post.model';
import { TimeAgoPipe } from '../../pipes/time-ago.pipe';
import { PostService } from '../../services/post.service';
import { PostDetailModalComponent } from '../post-detail-modal/post-detail-modal.component';

@Component({
  selector: 'app-instagram-post',
  standalone: true,
  imports: [CommonModule, TimeAgoPipe, MatDialogModule],
  template: `
    <div class="bg-white border rounded-lg mb-6 cursor-pointer" (click)="onPostClick($event)">
      <!-- Header with user info and verified badge -->
      <div class="p-3 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <img [src]="post.author.profile_picture || defaultAvatar" 
               [alt]="post.author.username"
               class="w-9 h-9 rounded-full">
          <div class="flex items-center gap-1.5">
            <span class="font-semibold text-[15px]">{{ post.author.username }}</span>
            <span class="text-gray-500 text-[14px]">·</span>
            <span class="text-gray-500 text-[14px]">{{ post.created_at | timeAgo }}</span>
          </div>
        </div>
        <!-- Verified Badge -->
        <div *ngIf="post.is_human_drawing && post.is_verified" 
             class="flex items-center gap-1 text-blue-500">
          <i class="fas fa-check-circle text-[13px]"></i>
          <span class="text-[13px] font-medium">Verified</span>
        </div>
      </div>

      <!-- Image -->
      <div class="relative pb-[100%]">
        <img [src]="post.image" 
             [alt]="'Post by ' + post.author.username"
             (error)="onImageError($event)"
             class="absolute inset-0 w-full h-full object-cover">
      </div>

      <!-- Engagement Buttons -->
      <div class="p-3">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-4">
            <button class="text-gray-500 hover:text-red-500 transition-colors"
                    (click)="onLike($event)">
              <i [class]="post.is_liked ? 'fas fa-heart text-red-500' : 'far fa-heart'"
                 class="text-[15px]"></i>
            </button>
            <button class="text-gray-500 hover:text-blue-500 transition-colors">
              <i class="far fa-comment text-[15px]"></i>
            </button>
          </div>
          <button class="text-gray-500 hover:text-blue-500 transition-colors"
                  (click)="onBookmark($event)">
            <i [class]="post.is_bookmarked ? 'fas fa-bookmark text-blue-500' : 'far fa-bookmark'"
               class="text-[15px]"></i>
          </button>
        </div>

        <!-- Likes count -->
        <div class="font-semibold text-[14px] mb-1">
          {{ post.likes_count || 0 }} likes
        </div>

        <!-- Content -->
        <p class="whitespace-pre-wrap text-[15px] leading-normal">
          <span class="font-semibold">{{ post.author.username }}</span>
          <span class="ml-2">{{ post.content }}</span>
        </p>

        <!-- Comments count -->
        <button *ngIf="post.comments_count" 
                class="text-gray-500 text-[13px] mt-1">
          View all {{ post.comments_count }} comments
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class InstagramStylePostComponent {
  @Input() post!: Post;
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  constructor(
    private dialog: MatDialog,
    private postService: PostService
  ) {}

  onPostClick(event: MouseEvent): void {
    // Don't open modal if clicking on buttons
    const target = event.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }
    
    this.dialog.open(PostDetailModalComponent, {
      data: this.post,
      panelClass: 'post-detail-modal',
      maxWidth: '100vw',
      maxHeight: '100vh',
      height: '100%',
      width: '100%'
    });
  }

  onLike(event: MouseEvent): void {
    event.stopPropagation();
    const handle = this.post.author.handle;
    this.postService.likePost(handle, this.post.id).subscribe({
      next: () => {
        this.post.is_liked = !this.post.is_liked;
        this.post.likes_count = (this.post.likes_count || 0) + (this.post.is_liked ? 1 : -1);
      },
      error: (error: Error) => console.error('Error toggling like:', error)
    });
  }

  onBookmark(event: MouseEvent): void {
    event.stopPropagation();
    const handle = this.post.author.handle;
    this.postService.bookmarkPost(handle, this.post.id).subscribe({
      next: () => {
        this.post.is_bookmarked = !this.post.is_bookmarked;
      },
      error: (error: Error) => console.error('Error toggling bookmark:', error)
    });
  }

  onImageError(event: any): void {
    console.error('Image failed to load:', event.target.src);
    event.target.src = 'assets/images/placeholder-image.png';
  }
} 