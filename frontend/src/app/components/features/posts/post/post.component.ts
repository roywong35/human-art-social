import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, NgZone, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Router, RouterModule } from '@angular/router';
import { TimeAgoPipe } from '../../../../pipes/time-ago.pipe';
import { Post } from '../../../../models/post.model';
import { User } from '../../../../models/user.model';
import { environment } from '../../../../../environments/environment';
import { BookmarkService } from '../../../../services/bookmark.service';
import { PostService } from '../../../../services/post.service';
import { CommentService } from '../../../../services/comment.service';
import { AuthService } from '../../../../services/auth.service';
import { PostUpdateService } from '../../../../services/post-update.service';
import { GlobalModalService } from '../../../../services/global-modal.service';
import { UserService } from '../../../../services/user.service';
import { Subscription } from 'rxjs';
import { CommentDialogComponent } from '../../comments/comment-dialog/comment-dialog.component';
import { RepostMenuComponent } from '../repost-menu/repost-menu.component';
import { NewPostModalComponent } from '../new-post-modal/new-post-modal.component';
import { ReportModalComponent } from '../report-modal/report-modal.component';

import { ToastService } from '../../../../services/toast.service';
import { take } from 'rxjs/operators';
import { PhotoViewerComponent } from '../../photo-viewer/photo-viewer.component';
import { LoginModalComponent } from '../../auth/login-modal/login-modal.component';
import { UserPreviewModalComponent } from '../../../shared/user-preview-modal/user-preview-modal.component';
import { HashtagDirective } from '../../../../directives/hashtag.directive';
import { DonationModalComponent } from '../donation-modal/donation-modal.component';
import { DonationsViewerComponent } from '../donations-viewer/donations-viewer.component';

@Component({
  selector: 'app-post',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    RouterModule,
    TimeAgoPipe,
    RepostMenuComponent,
    UserPreviewModalComponent,
    HashtagDirective
  ],
  templateUrl: './post.component.html',
  styleUrls: ['./post.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PostComponent implements OnInit, OnDestroy {
  @Input() post!: Post;
  @Input() showReplyContext: boolean = false; // Show "Replying to @handle" for bookmarked replies
  @Input() showFullHeader: boolean = true;
  @Input() isDetailView: boolean = false;
  @Input() isReply: boolean = false;
  @Input() showReplies: boolean = false;
  @Input() isConnectedToParent: boolean = false;
  @Input() isPreview = false;
  @Input() isInSearchResults = false;
  @Input() showRemovalBadge = false;

  @Output() postUpdated = new EventEmitter<Post>();
  @Output() postDeleted = new EventEmitter<number>();
  @Output() postReported = new EventEmitter<number>();
  @Output() replyClicked = new EventEmitter<void>();
  @Output() likeClicked = new EventEmitter<Post>();
  @Output() repostClicked = new EventEmitter<Post>();
  @Output() shareClicked = new EventEmitter<void>();
  @Output() bookmarkClicked = new EventEmitter<Post>();

  @ViewChild('replyTextarea') replyTextarea!: ElementRef;

  protected environment = environment;
  protected showRepostMenu = false;
  protected showMoreMenu = false;
  protected showShareMenu = false;
  
  // Dynamic positioning states
  protected shareMenuAbove = false;
  protected repostMenuAbove = false;
  protected moreMenuAbove = false;
  
  // Donation properties
  protected hasDonated = false;

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

  // User preview modal
  protected showUserPreview = false;
  protected userPreviewPosition = { x: 0, y: 0 };
  protected previewUser: User | null = null;
  private hoverTimeout: any;
  private leaveTimeout: any;
  private lastHoveredElement: Element | null = null;

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
    private postUpdateService: PostUpdateService,
    private globalModalService: GlobalModalService,
    private userService: UserService
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
    // Subscribe to auth state changes (reactive to login/logout)
    this.subscriptions.add(
      this.authService.currentUser$.subscribe(user => {
        this.currentUser = user;
        this.cd.markForCheck(); // Update view when auth state changes
      })
    );

    // Add click listener to close menus when clicking outside
    document.addEventListener('click', (event) => {
      if (this.showMoreMenu) {
        this.showMoreMenu = false;
        this.cd.markForCheck();
      }
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
        // Navigate to current post or referenced post for reposts
        const targetPost = this.post.post_type === 'repost' && this.post.referenced_post ? this.post.referenced_post : this.post;
        this.router.navigate([`/${targetPost.author.handle}/post/${targetPost.id}`]);
      }
    }
  }

  navigateToProfile(event: Event): void {
    event.stopPropagation();
    if (this.checkAuth('profile')) {
      this.router.navigate([`/${this.getDisplayAuthor().handle}`]);
    }
  }

  // Navigate to a specific user's profile (used in repost header username hover/click)
  protected navigateToUser(event: Event, user: User): void {
    event.stopPropagation();
    if (this.checkAuth('profile')) {
      this.router.navigate([`/${user.handle}`]);
    }
  }

  // Navigate to user profile by handle (used in reply context)
  protected navigateToUserByHandle(event: Event, handle: string): void {
    event.stopPropagation();
    if (this.checkAuth('profile')) {
      this.router.navigate([`/${handle}`]);
    }
  }

  // Get parent author handle for reply context (handles both direct replies and reposted replies)
  protected getParentAuthorHandle(): string {
    if (this.post.post_type === 'reply' && this.post.parent_post_author_handle) {
      return this.post.parent_post_author_handle;
    }
    if (this.post.post_type === 'repost' && this.post.referenced_post?.post_type === 'reply' && this.post.referenced_post.parent_post_author_handle) {
      return this.post.referenced_post.parent_post_author_handle;
    }
    return '';
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
        // Determine the target post for comments (original post for reposts)
        const targetPost = this.post.post_type === 'repost' ? this.post.referenced_post! : this.post;
        
        // Open comment dialog
        const dialogRef = this.dialog.open(CommentDialogComponent, {
          panelClass: ['comment-dialog', 'dialog-position-top'],
          data: {
            post: targetPost,
            currentUser: this.currentUser
          }
        });

        dialogRef.afterClosed().subscribe(result => {
          if (result) {
            // Comment was added to the target post, update the replies count
            if (this.post.post_type === 'repost' && this.post.referenced_post) {
              // Update the referenced post's count
              this.post.referenced_post.replies_count = (this.post.referenced_post.replies_count || 0) + 1;
            } else {
              // Update the regular post's count  
              this.post.replies_count = (this.post.replies_count || 0) + 1;
            }
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
      this.ngZone.run(() => {
        this.repostClicked.emit(this.post);
        this.cd.detectChanges();
      });
    }
  }

  // Toggle share menu instead of direct copy
  onShare(event: MouseEvent): void {
    event.stopPropagation();
    if (this.checkAuth('share')) {
      // Close all other menus first
      this.closeAllMenusExcept('share');
      this.showShareMenu = !this.showShareMenu;
      
      // Calculate positioning if menu is being opened
      if (this.showShareMenu) {
        const buttonElement = (event.target as HTMLElement).closest('div[title="Share"]') as HTMLElement || event.target as HTMLElement;
        this.updateMenuPositioning('share', buttonElement);
      }
    }
  }

  // Individual sharing methods
  protected copyLink(event: MouseEvent): void {
    event.stopPropagation();
    this.showShareMenu = false;
    const targetPost = this.post.post_type === 'repost' && this.post.referenced_post ? this.post.referenced_post : this.post;
    const postUrl = `${this.getBaseUrl()}/${targetPost.author.handle}/post/${targetPost.id}`;
    navigator.clipboard.writeText(postUrl).then(() => {
      this.toastService.showSuccess('Link copied to clipboard');
    }).catch(() => {
      this.toastService.showError('Failed to copy link');
    });
  }

  protected shareToFacebook(event: MouseEvent): void {
    event.stopPropagation();
    this.showShareMenu = false;
    const targetPost = this.post.post_type === 'repost' && this.post.referenced_post ? this.post.referenced_post : this.post;
    const postUrl = `${this.getBaseUrl()}/${targetPost.author.handle}/post/${targetPost.id}`;
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`;
    window.open(facebookUrl, '_blank', 'width=600,height=400');
  }

  protected shareToWhatsApp(event: MouseEvent): void {
    event.stopPropagation();
    this.showShareMenu = false;
    const targetPost = this.post.post_type === 'repost' && this.post.referenced_post ? this.post.referenced_post : this.post;
    const postUrl = `${this.getBaseUrl()}/${targetPost.author.handle}/post/${targetPost.id}`;
    const text = `Check out this post: ${postUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  }

  protected shareToTwitter(event: MouseEvent): void {
    event.stopPropagation();
    this.showShareMenu = false;
    const targetPost = this.post.post_type === 'repost' && this.post.referenced_post ? this.post.referenced_post : this.post;
    const postUrl = `${this.getBaseUrl()}/${targetPost.author.handle}/post/${targetPost.id}`;
    const text = 'Check out this post!';
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(postUrl)}`;
    window.open(twitterUrl, '_blank', 'width=600,height=400');
  }

  onDonate(event: MouseEvent): void {
    event.stopPropagation();
    if (this.checkAuth('donate')) {
      // For reposts, donate to the original post author, not the reposter
      const targetPost = this.post.post_type === 'repost' && this.post.referenced_post 
        ? this.post.referenced_post 
        : this.post;

      const dialogRef = this.dialog.open(DonationModalComponent, {
        width: '600px',
        maxWidth: '90vw',
        panelClass: ['donation-modal-fixed'],
        data: { post: targetPost }
      });

      dialogRef.afterClosed().subscribe((result: any) => {
        if (result) {
          // Donation was successful, update the button state
          this.hasDonated = true;
          this.cd.detectChanges();
        }
      });
    }
  }

  onViewDonations(event: MouseEvent): void {
    event.stopPropagation();
          const dialogRef = this.dialog.open(DonationsViewerComponent, {
        width: '600px',
        maxWidth: '90vw',
        panelClass: ['donation-modal-fixed'],
        data: { post: this.post }
      });
  }

  protected closeAllMenus(): void {
    this.showShareMenu = false;
    this.showRepostMenu = false;
    this.showMoreMenu = false;
    
    // Reset positioning states
    this.shareMenuAbove = false;
    this.repostMenuAbove = false;
    this.moreMenuAbove = false;
  }

  protected closeAllMenusExcept(except?: string): void {
    if (except !== 'share') this.showShareMenu = false;
    if (except !== 'repost') this.showRepostMenu = false;
    if (except !== 'more') this.showMoreMenu = false;
  }

  protected get hasAnyMenuOpen(): boolean {
    return this.showShareMenu || this.showRepostMenu || this.showMoreMenu;
  }

  protected closeAllMenusAndBackdrop(): void {
    this.closeAllMenus();
    this.cd.markForCheck();
  }

  // Dynamic positioning methods
  protected calculateMenuPosition(buttonElement: HTMLElement, menuHeight: number = 200): boolean {
    const buttonRect = buttonElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - buttonRect.bottom;
    const spaceAbove = buttonRect.top;
    
    // If there's not enough space below but enough space above, show above
    return spaceBelow < menuHeight && spaceAbove > menuHeight;
  }

  protected updateMenuPositioning(menuType: 'share' | 'repost' | 'more', buttonElement: HTMLElement): void {
    // Use setTimeout to ensure the calculation happens after the menu is rendered
    setTimeout(() => {
      const shouldShowAbove = this.calculateMenuPosition(buttonElement);
      
      switch (menuType) {
        case 'share':
          this.shareMenuAbove = shouldShowAbove;
          break;
        case 'repost':
          this.repostMenuAbove = shouldShowAbove;
          break;
        case 'more':
          this.moreMenuAbove = shouldShowAbove;
          break;
      }
      
      this.cd.markForCheck();
    }, 0);
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
      // Close all other menus first
      this.closeAllMenusExcept('repost');
      this.showRepostMenu = !this.showRepostMenu;
      
      // Calculate positioning if menu is being opened
      if (this.showRepostMenu) {
        const buttonElement = (event.target as HTMLElement).closest('div[title="Repost"]') as HTMLElement || event.target as HTMLElement;
        this.updateMenuPositioning('repost', buttonElement);
      }
    }
  }

  protected toggleMoreMenu(event: MouseEvent): void {
    event.stopPropagation();
    if (this.isPreview && !this.authService.isAuthenticated()) {
      this.checkAuth('more');
      return;
    }
    // Close all other menus first
    this.closeAllMenusExcept('more');
    this.showMoreMenu = !this.showMoreMenu;
    
    // Calculate positioning if menu is being opened
    if (this.showMoreMenu) {
      const buttonElement = (event.target as HTMLElement).closest('div[title="More"]') as HTMLElement || event.target as HTMLElement;
      this.updateMenuPositioning('more', buttonElement);
    }
  }

  protected onReportPost(event: MouseEvent): void {
    event.stopPropagation();
    this.showMoreMenu = false;
    
    if (!this.checkAuth('report')) {
      return;
    }

    const dialogRef = this.dialog.open(ReportModalComponent, {
      width: '500px',
      maxWidth: '90vw',
      panelClass: 'report-dialog',
      data: { post: this.post }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.success) {
        // Toast message is already shown by the modal component
        // Hide the post from the user's view immediately since they reported it
        this.postReported.emit(this.post.id);
      }
    });
  }

  private openQuoteModal(): void {
    const dialogRef = this.dialog.open(NewPostModalComponent, {
      panelClass: ['rounded-2xl', 'create-post-dialog'],
      maxWidth: '100vw',
      maxHeight: '100vh',
      width: '100vw',
      height: '100vh',
      disableClose: false,
      hasBackdrop: true,
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
    const post = sourcePost || (this.post.post_type === 'repost' && this.post.referenced_post ? this.post.referenced_post : this.post);
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

  get repliesCount(): number {
    return this.post.post_type === 'repost' ? this.post.referenced_post?.replies_count || 0 : this.post.replies_count || 0;
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
              this.router.navigate([`/${this.getDisplayAuthor().handle}`]);
              break;
            case 'report':
              this.onReportPost(new MouseEvent('click'));
              break;
            case 'donate':
              this.onDonate(new MouseEvent('click'));
              break;
          }
        }
      });
      return false;
    }
    return true;
  }

  protected getDisplayAuthor(): User {
    if (this.post.post_type === 'repost' && this.post.referenced_post?.author) {
      // For reposts, always show the referenced post's author (preserve the structure)
      return this.post.referenced_post.author;
    }
    return this.post.author;
  }

  protected getDisplayImages(): any[] | undefined {
    if (this.post.post_type === 'repost' && this.post.referenced_post) {
      // For reposts, always show the referenced post's images (preserve the structure)
      return this.post.referenced_post.images;
    }
    return this.post.images;
  }

  protected getDisplayIsHumanDrawing(): boolean {
    if (this.post.post_type === 'repost' && this.post.referenced_post) {
      // For reposts, always show the referenced post's human drawing status (preserve the structure)
      return this.post.referenced_post.is_human_drawing;
    }
    return this.post.is_human_drawing;
  }

  protected getDisplayIsVerified(): boolean {
    if (this.post.post_type === 'repost' && this.post.referenced_post) {
      // For reposts, always show the referenced post's verification status (preserve the structure)
      return this.post.referenced_post.is_verified;
    }
    return this.post.is_verified;
  }

  protected getDisplayCreatedAt(): string {
    if (this.post.post_type === 'repost' && this.post.referenced_post) {
      // For reposts, always show the referenced post's creation date (preserve the structure)
      return this.post.referenced_post.created_at;
    }
    return this.post.created_at;
  }

  protected getDisplayContent(): string {
    if (this.post.post_type === 'repost' && this.post.referenced_post) {
      // For reposts, always show the referenced post's content (preserve the structure)
      return this.post.referenced_post.content;
    }
    return this.post.content;
  }

  protected getReferencedPostContent(): string {
    const referencedPost = this.getReferencedPostForDisplay();
    return referencedPost ? referencedPost.content : '';
  }

  protected getReferencedPostImages(): any[] | undefined {
    const referencedPost = this.getReferencedPostForDisplay();
    return referencedPost ? referencedPost.images : undefined;
  }

  protected getReferencedPostForDisplay(): Post | undefined {
    if (this.post.post_type === 'quote' && this.post.referenced_post) {
      return this.post.referenced_post;
    }
    
    if (this.post.post_type === 'repost' && this.post.referenced_post?.post_type === 'quote' && this.post.referenced_post.referenced_post) {
      return this.post.referenced_post.referenced_post;
    }
    
    return undefined;
  }

  protected getReferencedPostForUrl(): Post | undefined {
    // Only show URL when this is a quote of a quote (double quote)
    if (
      this.post.post_type === 'quote' &&
      this.post.referenced_post?.post_type === 'quote' &&
      this.post.referenced_post.referenced_post
    ) {
      return this.post.referenced_post.referenced_post;
    }
    // Also show URL when quoting a repost that itself is a quote post
    if (
      this.post.post_type === 'quote' &&
      this.post.referenced_post?.post_type === 'repost' &&
      this.post.referenced_post.referenced_post?.post_type === 'quote' &&
      this.post.referenced_post.referenced_post.referenced_post
    ) {
      return this.post.referenced_post.referenced_post.referenced_post;
    }
    // Do not show URL for reposts or regular quotes
    return undefined;
  }

  protected getBaseUrl(): string {
    return window.location.origin;
  }

  protected getDisplayUrl(): string {
    return window.location.origin.replace('https://', '').replace('http://', '');
  }

  protected navigateToParentAuthor(event: Event): void {
    event.stopPropagation();
    if (this.post.parent_post_author_handle) {
      this.router.navigate(['/', this.post.parent_post_author_handle]);
    }
  }

  // User preview modal methods
  protected onUserHover(event: MouseEvent, user: User): void {
    // Clear any pending timeouts
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }
    if (this.leaveTimeout) {
      clearTimeout(this.leaveTimeout);
    }

    this.hoverTimeout = setTimeout(() => {
      // Store the hovered element for accurate positioning
      this.lastHoveredElement = event.target as Element;
      
      
      // For reposts: fetch first and then show to avoid flash of 0 counts/bio
      if (this.post.post_type === 'repost') {
        this.userService.getUserByHandle(user.handle).pipe(take(1)).subscribe({
          next: (fullUser) => {
            this.globalModalService.showUserPreviewAccurate(fullUser, this.lastHoveredElement!, {
              clearLeaveTimeout: () => {
                if (this.leaveTimeout) {
                  clearTimeout(this.leaveTimeout);
                }
              }
            });
          },
          error: () => {
            // Fallback: show lightweight preview if fetch fails
            this.globalModalService.showUserPreviewAccurate(user, this.lastHoveredElement!, {
              clearLeaveTimeout: () => {
                if (this.leaveTimeout) {
                  clearTimeout(this.leaveTimeout);
                }
              }
            });
          }
        });
      } else {
        // Normal posts: show immediately, then enrich in place to keep responsiveness
        this.globalModalService.showUserPreviewAccurate(user, this.lastHoveredElement, {
          clearLeaveTimeout: () => {
            if (this.leaveTimeout) {
              clearTimeout(this.leaveTimeout);
            }
          }
        });

        // Fetch full profile (followers/following/bio) for accurate stats
        this.userService.getUserByHandle(user.handle).pipe(take(1)).subscribe({
          next: (fullUser) => {
            // If modal is still visible, update content without repositioning to avoid flicker
            const state = this.globalModalService.getCurrentState();
            if (state.isVisible) {
              this.globalModalService.showUserPreview(fullUser, state.position);
            }
          },
          error: () => {
            // Ignore errors; keep lightweight preview
          }
        });
      }
    }, 300); // 300ms delay - faster than Twitter
  }

  protected onUserHoverLeave(): void {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }
    
    // Longer delay to allow moving to the modal
    this.leaveTimeout = setTimeout(() => {
      this.globalModalService.hideUserPreview();
    }, 300); // 300ms delay to allow moving to modal
  }

  protected onModalHover(): void {
    // When hovering over the modal, cancel any pending close
    if (this.leaveTimeout) {
      clearTimeout(this.leaveTimeout);
    }
    this.globalModalService.onModalHover();
  }

  protected closeUserPreview(): void {
    // Clear any pending timeouts
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }
    if (this.leaveTimeout) {
      clearTimeout(this.leaveTimeout);
    }
    
    this.showUserPreview = false;
    this.previewUser = null;
    this.cd.detectChanges();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // Only close if we have menus open and the click is outside the component
    if (this.hasAnyMenuOpen) {
      this.closeAllMenus();
      this.cd.markForCheck();
    }
  }
} 