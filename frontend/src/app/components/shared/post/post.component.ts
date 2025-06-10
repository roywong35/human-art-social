import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Router, RouterModule } from '@angular/router';
import { TimeAgoPipe } from '../../../pipes/time-ago.pipe';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { Post } from '../../../models/post.model';
import { User } from '../../../models/user.model';
import { Comment } from '../../../models/comment.model';
import { environment } from '../../../../environments/environment';
import { BookmarkService } from '../../../services/bookmark.service';
import { PostService } from '../../../services/post.service';
import { CommentService } from '../../../services/comment.service';
import { AuthService } from '../../../services/auth.service';
import { PostUpdateService } from '../../../services/post-update.service';
import { Subscription } from 'rxjs';
import { CommentDialogComponent } from '../../../components/comment-dialog/comment-dialog.component';
import { PostInputBoxComponent } from '../post-input-box/post-input-box.component';
import { CommentComponent } from '../comment/comment.component';

@Component({
  selector: 'app-post',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    RouterModule,
    TimeAgoPipe,
    CommentComponent
  ],
  templateUrl: './post.component.html',
  styleUrls: ['./post.component.scss']
})
export class PostComponent implements OnInit, OnDestroy {
  @Input() post!: Post;
  @Input() showFullHeader: boolean = true;
  @Input() isDetailView: boolean = false;
  @Input() showComments: boolean = false;

  @Output() postUpdated = new EventEmitter<void>();
  @Output() replyClicked = new EventEmitter<void>();
  @Output() likeClicked = new EventEmitter<void>();
  @Output() repostClicked = new EventEmitter<void>();
  @Output() shareClicked = new EventEmitter<void>();
  @Output() bookmarkClicked = new EventEmitter<void>();

  @ViewChild('commentTextarea') commentTextarea!: ElementRef;
  @ViewChild('replyTextarea') replyTextarea!: ElementRef;

  protected environment = environment;
  protected showRepostMenu = false;
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  // Comment functionality
  protected currentUser: User | null = null;
  protected comments: Comment[] = [];
  protected newComment: string = '';
  protected newReply: string = '';
  protected commentFocused: boolean = false;
  protected replyFocused: boolean = false;
  protected replyingTo: Comment | null = null;
  protected showEmojiPicker: boolean = false;
  protected emojiPickerPosition = { top: 0, left: 0 };
  protected replyContent: string = '';

  private postUpdateSubscription: Subscription;

  constructor(
    private router: Router,
    private dialog: MatDialog,
    private postService: PostService,
    private bookmarkService: BookmarkService,
    private commentService: CommentService,
    private authService: AuthService,
    private postUpdateService: PostUpdateService
  ) {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });

    this.postUpdateSubscription = this.postUpdateService.postUpdate$.subscribe(
      ({ handle, postId, updatedPost }) => {
        if (this.post.id === postId) {
          Object.assign(this.post, updatedPost);
          this.postUpdated.emit();
        } else if (this.post.post_type === 'repost' && 
                  this.post.referenced_post && 
                  this.post.referenced_post.id === postId) {
          Object.assign(this.post.referenced_post, updatedPost);
          this.postUpdated.emit();
        }
      }
    );
  }

  ngOnInit(): void {
    // Load comments if we're showing them
    if (this.showComments || this.isDetailView) {
      this.loadComments();
    }
  }

  ngOnDestroy(): void {
    if (this.postUpdateSubscription) {
      this.postUpdateSubscription.unsubscribe();
    }
  }

  protected get canComment(): boolean {
    return this.newComment.trim().length > 0;
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
    if (this.replyingTo) {
      this.newReply += emoji;
      this.replyTextarea.nativeElement.focus();
    } else {
      this.newComment += emoji;
      this.commentTextarea.nativeElement.focus();
    }
    this.showEmojiPicker = false;
  }

  protected loadComments(): void {
    const handle = this.post.author.handle;
    this.commentService.getComments(handle, this.post.id).subscribe({
      next: (comments) => {
        this.comments = comments;
      },
      error: (error) => {
        console.error('Error loading comments:', error);
      }
    });
  }

  protected submitComment(): void {
    if (!this.canComment) return;

    const handle = this.post.author.handle;
    this.commentService.createComment(handle, this.post.id, this.newComment).subscribe({
      next: (comment) => {
        this.comments.unshift(comment);
        this.newComment = '';
        this.commentFocused = false;
        this.post.comments_count = (this.post.comments_count || 0) + 1;
        this.postUpdated.emit();
      },
      error: (error) => {
        console.error('Error creating comment:', error);
      }
    });
  }

  replyToComment(comment: Comment, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.replyingTo = this.replyingTo?.id === comment.id ? null : comment;
    this.replyContent = '';
    if (!event) { // Only focus if it's not from a click event
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

  navigateToPost(): void {
    const handle = this.post.author.handle;
    this.router.navigate([`/${handle}/post`, this.post.id]);
  }

  navigateToProfile(event: MouseEvent): void {
    event.stopPropagation();
    const handle = this.post.author.handle;
    this.router.navigate([`/${handle}`]);
  }

  navigateToComment(comment: Comment, event: MouseEvent): void {
    event.stopPropagation();
    const handle = this.post.author.handle;
    this.router.navigate([`/${handle}/post`, this.post.id, 'comment', comment.id]);
  }

  onReply(event: MouseEvent): void {
    event.stopPropagation();
    this.dialog.open(CommentDialogComponent, {
      data: {
        post: this.post,
        currentUser: this.currentUser
      },
      width: '600px',
      panelClass: ['comment-dialog', 'dialog-position-top'],
      position: { top: '5%' }
    }).afterClosed().subscribe(result => {
      if (result) {
        this.postUpdated.emit();
      }
    });
    this.replyClicked.emit();
  }

  onLike(event: MouseEvent): void {
    event.stopPropagation();
    const handle = this.post.author.handle;
    this.postService.likePost(handle, this.post.id).subscribe({
      next: () => {
        this.post.is_liked = !this.post.is_liked;
        this.post.likes_count = (this.post.likes_count || 0) + (this.post.is_liked ? 1 : -1);
        this.likeClicked.emit();
      },
      error: (error) => console.error('Error liking post:', error)
    });
  }

  onRepost(event: MouseEvent): void {
    event.stopPropagation();
    const handle = this.post.author.handle;
    this.postService.repost(handle, this.post.id).subscribe({
      next: (response) => {
        this.post = response;
        this.postUpdateService.emitPostUpdate(handle, this.post.id, this.post);
        this.repostClicked.emit();
      },
      error: (error) => console.error('Error reposting:', error)
    });
  }

  onShare(event: MouseEvent): void {
    event.stopPropagation();
    const handle = this.post.author.handle;
    const url = `${window.location.origin}/${handle}/post/${this.post.id}`;
    navigator.clipboard.writeText(url).then(() => {
      // Could show a toast notification here
      console.log('Link copied to clipboard');
      this.shareClicked.emit();
    });
  }

  onBookmark(event: MouseEvent): void {
    event.stopPropagation();
    const handle = this.post.author.handle;
    this.bookmarkService.toggleBookmark(handle, this.post.id).subscribe({
      next: () => {
        this.post.is_bookmarked = !this.post.is_bookmarked;
        this.bookmarkClicked.emit();
      },
      error: (error) => console.error('Error bookmarking post:', error)
    });
  }

  protected onImageError(event: any): void {
    console.error('Image failed to load:', event.target.src);
    event.target.src = 'assets/placeholder-image.svg';
  }
} 