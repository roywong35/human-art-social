import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Router, RouterModule } from '@angular/router';
import { TimeAgoPipe } from '../../../pipes/time-ago.pipe';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { Post } from '../../../models/post.model';
import { Comment } from '../../../models/comment.model';
import { User } from '../../../models/user.model';
import { environment } from '../../../../environments/environment';
import { BookmarkService } from '../../../services/bookmark.service';
import { PostService } from '../../../services/post.service';
import { CommentService } from '../../../services/comment.service';
import { AuthService } from '../../../services/auth.service';
import { PostUpdateService } from '../../../services/post-update.service';
import { Subscription } from 'rxjs';
import { PostInputBoxComponent } from '../post-input-box/post-input-box.component';
import { CommentDialogComponent } from '../../comment-dialog/comment-dialog.component';
import { RepostMenuComponent } from '../repost-menu/repost-menu.component';
import { NewPostModalComponent } from '../../new-post-modal/new-post-modal.component';
import { NotificationService } from '../../../services/notification.service';
import { take } from 'rxjs/operators';
import { PhotoViewerComponent } from '../../photo-viewer/photo-viewer.component';

@Component({
  selector: 'app-human-art-post',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    RouterModule,
    TimeAgoPipe,
    RepostMenuComponent
  ],
  templateUrl: './human-art-post.component.html',
  styleUrls: ['./human-art-post.component.scss']
})
export class HumanArtPostComponent implements OnInit, OnDestroy {
  @Input() post!: Post;
  @Input() showFullHeader: boolean = true;
  @Input() isDetailView: boolean = false;
  @Input() isReply: boolean = false;
  @Input() showReplies: boolean = false;
  @Input() isConnectedToParent: boolean = false;

  @Output() postUpdated = new EventEmitter<Post>();
  @Output() postDeleted = new EventEmitter<number>();
  @Output() replyClicked = new EventEmitter<void>();
  @Output() likeClicked = new EventEmitter<void>();
  @Output() repostClicked = new EventEmitter<void>();
  @Output() shareClicked = new EventEmitter<void>();
  @Output() bookmarkClicked = new EventEmitter<void>();

  @ViewChild('replyTextarea') replyTextarea!: ElementRef;

  protected environment = environment;
  protected showRepostMenu = false;
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  // Reply functionality
  protected currentUser: User | null = null;
  protected replies: Post[] = [];
  protected newReply: string = '';
  protected replyFocused: boolean = false;
  protected replyingTo: Post | null = null;
  protected showEmojiPicker: boolean = false;
  protected emojiPickerPosition = { top: 0, left: 0 };
  protected replyContent: string = '';

  protected repostMenuPosition = { top: 0, left: 0 };

  private subscriptions = new Subscription();
  private imageAspectRatios: { [key: string]: number } = {};

  constructor(
    private router: Router,
    private dialog: MatDialog,
    private postService: PostService,
    private bookmarkService: BookmarkService,
    private commentService: CommentService,
    private authService: AuthService,
    private postUpdateService: PostUpdateService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {
    this.subscriptions.add(
      this.postUpdateService.postUpdate$.subscribe(
        ({ postId, updatedPost }) => {
          if (this.post.id === postId) {
            this.post = { ...this.post, ...updatedPost };
          }
        }
      )
    );
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.authService.currentUser$.pipe(take(1)).subscribe(user => {
        this.currentUser = user;
      })
    );

    // Load replies if we're showing them
    if (this.showReplies || this.isDetailView) {
      this.loadReplies();
    }

    // Only refresh post in detail view
    if (this.isDetailView && this.post) {
      this.postService.refreshPost(this.post.author.handle, this.post.id).subscribe();
    }
  }

  ngOnDestroy(): void {
    if (this.subscriptions) {
      this.subscriptions.unsubscribe();
    }
  }

  protected get canReply(): boolean {
    return this.newReply.trim().length > 0;
  }

  protected adjustTextareaHeight(event: any): void {
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  protected toggleEmojiPicker(event: MouseEvent): void {
    event.stopPropagation();
    this.showEmojiPicker = !this.showEmojiPicker;
    if (this.showEmojiPicker) {
      const button = event.target as HTMLElement;
      const rect = button.getBoundingClientRect();
      this.emojiPickerPosition = {
        top: rect.bottom + window.scrollY + 5,
        left: rect.left + window.scrollX - 320 + rect.width
      };
    }
  }

  protected addEmoji(event: any): void {
    const emoji = event.emoji.native;
    this.newReply += emoji;
    this.replyTextarea.nativeElement.focus();
    this.showEmojiPicker = false;
  }

  protected loadReplies(): void {
    const handle = this.post.author.handle;
    this.commentService.getComments(handle, this.post.id).subscribe({
      next: (replies) => {
        this.replies = replies;
      },
      error: (error) => {
        console.error('Error loading replies:', error);
      }
    });
  }

  protected submitReply(): void {
    if (!this.canReply) return;

    const handle = this.post.author.handle;
    this.commentService.createComment(handle, this.post.id, this.newReply).subscribe({
      next: (reply) => {
        this.replies.unshift(reply);
        this.newReply = '';
        this.replyFocused = false;
        this.post.replies_count = (this.post.replies_count || 0) + 1;
        this.postUpdated.emit(this.post);
      },
      error: (error) => {
        console.error('Error creating reply:', error);
      }
    });
  }

  replyToPost(post: Post, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.replyingTo = this.replyingTo?.id === post.id ? null : post;
    this.replyContent = '';
    if (!event) {
      setTimeout(() => {
        this.replyTextarea?.nativeElement.focus();
      });
    }
  }

  cancelReply(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.replyingTo = null;
    this.replyContent = '';
    this.replyFocused = false;
  }

  protected navigateToPost(): void {
    this.router.navigate([`/${this.post.author.handle}/post`, this.post.id]);
  }

  protected navigateToProfile(event: MouseEvent): void {
    event.stopPropagation();
    this.router.navigate([`/${this.post.author.handle}`]);
  }

  protected onImageError(event: any): void {
    event.target.src = this.defaultAvatar;
  }

  protected getImageLayoutClass(index: number, totalImages: number): string {
    if (totalImages === 1) return 'w-full h-full';
    if (totalImages === 2) return 'w-1/2 h-full';
    if (totalImages === 3) {
      if (index === 0) return 'w-1/2 h-full';
      return 'w-full h-1/2';
    }
    if (totalImages === 4) return 'w-1/2 h-1/2';
    return '';
  }

  protected getImageAspectRatio(imageUrl: string | undefined): number {
    if (!imageUrl) return 1;
    if (this.imageAspectRatios[imageUrl]) return this.imageAspectRatios[imageUrl];
    
    const img = new Image();
    img.onload = () => {
      const ratio = img.width / img.height;
      this.imageAspectRatios[imageUrl] = ratio;
      // Force change detection
      this.cdr.detectChanges();
    };
    img.src = imageUrl;
    
    return 1; // Default to 1:1 until loaded
  }

  protected onPhotoClick(event: MouseEvent, index: number): void {
    event.stopPropagation();
    // Implement photo viewer logic here
  }

  protected onReply(event: MouseEvent): void {
    event.stopPropagation();
    // Implement reply logic here
  }

  protected toggleRepostMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.showRepostMenu = !this.showRepostMenu;
  }

  protected onRepostOption(option: string): void {
    // Implement repost option logic here
  }

  protected onLike(event: MouseEvent): void {
    event.stopPropagation();
    // Implement like logic here
  }

  protected onShare(event: MouseEvent): void {
    event.stopPropagation();
    // Implement share logic here
  }

  protected onBookmark(event: MouseEvent): void {
    event.stopPropagation();
    // Implement bookmark logic here
  }
} 