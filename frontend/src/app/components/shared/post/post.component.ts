import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Router, RouterModule } from '@angular/router';
import { TimeAgoPipe } from '../../../pipes/time-ago.pipe';
import { Post } from '../../../models/post.model';
import { User } from '../../../models/user.model';
import { environment } from '../../../../environments/environment';
import { BookmarkService } from '../../../services/bookmark.service';
import { PostService } from '../../../services/post.service';
import { CommentService } from '../../../services/comment.service';
import { AuthService } from '../../../services/auth.service';
import { PostUpdateService } from '../../../services/post-update.service';
import { Subscription } from 'rxjs';
import { CommentDialogComponent } from '../../comment-dialog/comment-dialog.component';
import { RepostMenuComponent } from '../repost-menu/repost-menu.component';
import { NewPostModalComponent } from '../../new-post-modal/new-post-modal.component';
import { ToastService } from '../../../services/toast.service';
import { take } from 'rxjs/operators';
import { PhotoViewerComponent } from '../../photo-viewer/photo-viewer.component';
import { LoginModalComponent } from '../../login-modal/login-modal.component';

@Component({
  selector: 'app-post',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    RouterModule,
    TimeAgoPipe,
    RepostMenuComponent
  ],
  templateUrl: './post.component.html',
  styleUrls: ['./post.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PostComponent implements OnInit, OnDestroy {
  @Input() post!: Post;
  @Input() showFullHeader: boolean = true;
  @Input() isDetailView: boolean = false;
  @Input() isReply: boolean = false;
  @Input() showReplies: boolean = false;
  @Input() isConnectedToParent: boolean = false;
  @Input() isPreview = false;

  @Output() postUpdated = new EventEmitter<Post>();
  @Output() postDeleted = new EventEmitter<number>();
  @Output() replyClicked = new EventEmitter<void>();
  @Output() likeClicked = new EventEmitter<Post>();
  @Output() repostClicked = new EventEmitter<Post>();
  @Output() shareClicked = new EventEmitter<void>();
  @Output() bookmarkClicked = new EventEmitter<Post>();

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
  protected showReplyOptions = false;

  protected repostMenuPosition = { top: 0, left: 0 };

  private subscriptions = new Subscription();
  private imageAspectRatios: { [key: string]: number } = {};

  constructor(
    private dialog: MatDialog,
    private postService: PostService,
    private bookmarkService: BookmarkService,
    private commentService: CommentService,
    private toastService: ToastService,
    private cd: ChangeDetectorRef,
    private ngZone: NgZone,
    private authService: AuthService,
    private router: Router,
    private postUpdateService: PostUpdateService
  ) {
    this.subscriptions.add(
      this.postUpdateService.postUpdate$.subscribe(
        ({ postId, updatedPost }) => {
          if (this.post.id === postId) {
            this.post = { ...this.post, ...updatedPost };
            this.cd.markForCheck();
          }
        }
      )
    );
  }

  ngOnInit(): void {
    this.authService.currentUser$.pipe(take(1)).subscribe(user => {
      this.currentUser = user;
    });

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

  ngOnChanges() {
    this.cd.markForCheck();
  }

  ngDoCheck() {
    // Log any changes to the post
    // console.log('Post component: Checking post state:', { 
    //   id: this.post.id, 
    //   type: this.post.post_type,
    //   isLiked: this.post.is_liked,
    //   likesCount: this.post.likes_count,
    //   isReposted: this.post.is_reposted,
    //   repostsCount: this.post.reposts_count,
    //   isBookmarked: this.post.is_bookmarked,
    //   referencedPostId: this.post.post_type === 'repost' ? this.post.referenced_post?.id : undefined
    // });
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

  navigateToPost(event: Event, quotedPost?: Post): void {
    event.stopPropagation();
    if (this.checkAuth('post')) {
      if (quotedPost) {
        // Navigate to quoted post
        this.router.navigate(['/', quotedPost.author.handle, 'post', quotedPost.id]);
      } else {
        // Navigate to current post
        this.router.navigate([`/${this.post.author.handle}/post/${this.post.id}`]);
      }
    }
  }

  navigateToProfile(event: Event): void {
    event.stopPropagation();
    if (this.checkAuth('profile')) {
      this.router.navigate([`/${this.post.author.handle}`]);
    }
  }

  onReply(event: Event): void {
    event.stopPropagation();
    if (this.checkAuth('reply')) {
      if (this.isDetailView) {
        this.replyFocused = true;
        setTimeout(() => {
          this.replyTextarea?.nativeElement.focus();
        });
      } else {
        // Open comment dialog
        const dialogRef = this.dialog.open(CommentDialogComponent, {
          panelClass: ['comment-dialog', 'dialog-position-top'],
          data: {
            post: this.post,
            currentUser: this.currentUser
          }
        });

        dialogRef.afterClosed().subscribe(result => {
          if (result) {
            // Comment was added, update the post
            this.post.replies_count = (this.post.replies_count || 0) + 1;
            this.postUpdated.emit(this.post);
          }
        });
      }
    }
  }

  onLike(event: Event): void {
    event.stopPropagation();
    if (this.checkAuth('like')) {
      this.likeClicked.emit(this.post);
    }
  }

  onRepost(event: Event): void {
    event.stopPropagation();
    if (this.checkAuth('repost')) {
      console.log('Post component: Emitting repost event for post:', { 
        id: this.post.id, 
        type: this.post.post_type,
        referencedPostId: this.post.post_type === 'repost' ? this.post.referenced_post?.id : undefined
      });
      this.ngZone.run(() => {
        this.repostClicked.emit(this.post);
        this.cd.detectChanges();
      });
    }
  }

  onShare(event: MouseEvent): void {
    event.stopPropagation();
    if (this.checkAuth('share')) {
      const postUrl = `${this.getBaseUrl()}/${this.post.author.handle}/post/${this.post.id}`;
      navigator.clipboard.writeText(postUrl).then(() => {
        this.toastService.showSuccess('Link copied to clipboard');
      }).catch(() => {
        this.toastService.showError('Failed to copy link');
      });
    }
  }

  onBookmark(event: Event): void {
    event.stopPropagation();
    if (this.checkAuth('bookmark')) {
      this.bookmarkClicked.emit(this.post);
    }
  }

  protected onImageError(event: any): void {
    event.target.src = this.defaultAvatar;
  }

  protected getImageLayoutClass(index: number, totalImages: number | undefined): string {
    if (!totalImages) return '';
    if (totalImages === 1) return 'w-full h-full';
    if (totalImages === 2) return 'w-1/2 h-full';
    if (totalImages === 3) {
      if (index === 0) return 'w-1/2 h-full';
      return 'w-full h-1/2';
    }
    if (totalImages === 4) return 'w-1/2 h-1/2';
    return '';
  }

  protected toggleRepostMenu(event: MouseEvent): void {
    event.stopPropagation();
    if (this.checkAuth('repost')) {
      this.showRepostMenu = !this.showRepostMenu;
    }
  }

  private openQuoteModal(): void {
    const dialogRef = this.dialog.open(NewPostModalComponent, {
      width: '600px',
      panelClass: ['rounded-2xl', 'create-post-dialog'],
      data: { quotePost: this.post }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Quote post created successfully
      }
    });
  }

  async onRepostOption(option: 'repost' | 'quote' | 'unrepost') {
    if (option === 'quote') {
      this.openQuoteModal();
      return;
    }

    this.showRepostMenu = false; // Close menu immediately

    if (option === 'repost' || option === 'unrepost') {
      this.onRepost(new Event('click'));
    }
  }

  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this post?')) {
      this.postService.deletePost(this.post.author.handle, this.post.id).subscribe({
        next: () => {
          this.postDeleted.emit(this.post.id);
        },
        error: (error) => {
          console.error('Error deleting post:', error);
        }
      });
    }
  }

  protected getImageAspectRatio(imageUrl: string | undefined): number {
    if (!imageUrl) return 1;
    if (this.imageAspectRatios[imageUrl]) return this.imageAspectRatios[imageUrl];
    
    const img = new Image();
    img.onload = () => {
      const ratio = img.width / img.height;
      this.imageAspectRatios[imageUrl] = ratio;
      // Force change detection
      this.cd.detectChanges();
    };
    img.src = imageUrl;
    
    return 1; // Default to 1:1 until loaded
  }

  protected onPhotoClick(event: Event, index: number, sourcePost?: Post): void {
    event.stopPropagation();
    const post = sourcePost || this.post;
    const photos = post.images || [];
    this.dialog.open(PhotoViewerComponent, {
      width: '100vw',
      height: '100vh',
      maxWidth: '100vw',
      maxHeight: '100vh',
      panelClass: 'photo-viewer-dialog',
      data: {
        photos: photos,
        initialPhotoIndex: index
      }
    });
  }

  // Getters for safe state access
  get isLiked(): boolean {
    return this.post.post_type === 'repost' ? !!this.post.referenced_post?.is_liked : !!this.post.is_liked;
  }

  get isReposted(): boolean {
    return this.post.post_type === 'repost' ? !!this.post.referenced_post?.is_reposted : !!this.post.is_reposted;
  }

  get isBookmarked(): boolean {
    return this.post.post_type === 'repost' ? !!this.post.referenced_post?.is_bookmarked : !!this.post.is_bookmarked;
  }

  get likesCount(): number {
    return this.post.post_type === 'repost' ? this.post.referenced_post?.likes_count || 0 : this.post.likes_count || 0;
  }

  get repostsCount(): number {
    return this.post.post_type === 'repost' ? this.post.referenced_post?.reposts_count || 0 : this.post.reposts_count || 0;
  }

  // Public method to force change detection
  forceUpdate(): void {
    this.cd.detectChanges();
  }

  protected checkAuth(action: string): boolean {
    if (!this.authService.isAuthenticated()) {
      const dialogRef = this.dialog.open(LoginModalComponent, {
        width: '400px',
        panelClass: 'custom-dialog-container',
        disableClose: false // Allow clicking outside to close
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          // User has logged in, retry the action
          switch (action) {
            case 'like':
              this.likeClicked.emit(this.post);
              break;
            case 'repost':
              this.repostClicked.emit(this.post);
              break;
            case 'bookmark':
              this.bookmarkClicked.emit(this.post);
              break;
            case 'reply':
              this.onReply(new Event('click'));
              break;
            case 'share':
              this.shareClicked.emit();
              break;
            case 'post':
              this.router.navigate([`/${this.post.author.handle}/post/${this.post.id}`]);
              break;
            case 'profile':
              this.router.navigate([`/${this.post.author.handle}`]);
              break;
          }
        }
      });
      return false;
    }
    return true;
  }

  protected getBaseUrl(): string {
    return window.location.origin;
  }

  protected getDisplayUrl(): string {
    return window.location.origin.replace('https://', '').replace('http://', '');
  }
} 