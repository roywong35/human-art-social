import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Comment } from '../../../../models/comment.model';
import { Post } from '../../../../models/post.model';
import { TimeAgoPipe } from '../../../../pipes/time-ago.pipe';

@Component({
  selector: 'app-comment',
  standalone: true,
  imports: [CommonModule, TimeAgoPipe],
  templateUrl: './comment.component.html'
})
export class CommentComponent {
  @Input() comment!: Comment;
  @Input() post!: Post;
  @Input() postId!: number;
  @Output() commentUpdated = new EventEmitter<void>();
  @Output() replyClicked = new EventEmitter<void>();
  @Output() likeClicked = new EventEmitter<void>();
  @Output() repostClicked = new EventEmitter<void>();
  @Output() shareClicked = new EventEmitter<void>();
  @Output() bookmarkClicked = new EventEmitter<void>();

  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  constructor(private router: Router) {}

  navigateToComment(): void {
    const handle = this.comment.author.handle;
    const postId = this.comment.post_id;
    this.router.navigate([`/${handle}/post`, postId, 'comment', this.comment.id]);
  }

  navigateToProfile(event: MouseEvent): void {
    event.stopPropagation();
    const handle = this.comment.author.handle;
    this.router.navigate([`/${handle}`]);
  }

  onReply(event: MouseEvent): void {
    event.stopPropagation();
    this.replyClicked.emit();
  }

  onLike(event: MouseEvent): void {
    event.stopPropagation();
    this.likeClicked.emit();
  }

  onRepost(event: MouseEvent): void {
    event.stopPropagation();
    this.repostClicked.emit();
  }

  onShare(event: MouseEvent): void {
    event.stopPropagation();
    this.shareClicked.emit();
  }

  onBookmark(event: MouseEvent): void {
    event.stopPropagation();
    this.bookmarkClicked.emit();
  }

  onImageError(event: any): void {
    event.target.src = this.defaultAvatar;
  }

  protected getFormattedDate(dateString: string): string {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    };
    
    return date.toLocaleString('en-US', options);
  }
} 