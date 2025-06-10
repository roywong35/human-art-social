import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Post } from '../../models/post.model';
import { TimeAgoPipe } from '../../pipes/time-ago.pipe';
import { PostService } from '../../services/post.service';

@Component({
  selector: 'app-post-detail-modal',
  standalone: true,
  imports: [CommonModule, TimeAgoPipe],
  template: `
    <div class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" (click)="close()">
      <div class="bg-white rounded-lg max-w-6xl w-full mx-4 max-h-[90vh] flex" (click)="$event.stopPropagation()">
        <!-- Left side - Image -->
        <div class="w-[60%] bg-black flex items-center justify-center">
          <img 
            [src]="post.image" 
            [alt]="'Post by ' + post.author.username"
            class="max-h-[90vh] w-full object-contain"
            (error)="onImageError($event)">
        </div>

        <!-- Right side - Content -->
        <div class="w-[40%] flex flex-col h-[90vh]">
          <!-- Header -->
          <div class="p-4 border-b flex items-center space-x-3">
            <img 
              [src]="post.author.profile_picture || defaultAvatar" 
              [alt]="post.author.username"
              class="w-8 h-8 rounded-full">
            <div>
              <div class="font-semibold">{{ post.author.username }}</div>
              <div class="text-sm text-gray-500">{{ '@' + (post.author.handle || post.author.username) }}</div>
            </div>
            <!-- Verified Badge for Human Art -->
            <div *ngIf="post.is_human_drawing && post.is_verified" 
                 class="ml-auto inline-flex items-center gap-1 bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
              <i class="fas fa-check-circle"></i>
              <span>Verified Human Art</span>
            </div>
          </div>

          <!-- Content -->
          <div class="p-4 border-b">
            <p class="whitespace-pre-wrap">{{ post.content }}</p>
            <div class="text-sm text-gray-500 mt-2">
              {{ post.created_at | timeAgo }}
            </div>
          </div>

          <!-- Comments Section -->
          <div class="flex-1 overflow-y-auto p-4">
            <!-- Comments will be added here -->
          </div>

          <!-- Engagement Section -->
          <div class="border-t p-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-4">
                <button class="text-gray-500 hover:text-red-500">
                  <i [class]="post.is_liked ? 'fas fa-heart text-red-500' : 'far fa-heart'"></i>
                  <span class="ml-1">{{ post.likes_count || 0 }}</span>
                </button>
                <button class="text-gray-500 hover:text-blue-500">
                  <i class="far fa-comment"></i>
                  <span class="ml-1">{{ post.comments_count || 0 }}</span>
                </button>
              </div>
              <button class="text-gray-500 hover:text-blue-500">
                <i [class]="post.is_bookmarked ? 'fas fa-bookmark text-blue-500' : 'far fa-bookmark'"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Close button -->
        <button 
          class="absolute top-4 right-4 text-white hover:text-gray-300 text-xl"
          (click)="close()">
          <i class="fas fa-times"></i>
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
export class PostDetailModalComponent {
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  constructor(
    @Inject(MAT_DIALOG_DATA) public post: Post,
    private dialogRef: MatDialogRef<PostDetailModalComponent>,
    private postService: PostService
  ) {}

  close(): void {
    this.dialogRef.close();
  }

  onImageError(event: any): void {
    console.error('Image failed to load:', event.target.src);
    event.target.src = 'assets/images/placeholder-image.png';
  }
} 