import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, HostListener, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Post } from '../../../../models/post.model';
import { PostService } from '../../../../services/post.service';
import { AuthService } from '../../../../services/auth.service';
import { CommentService } from '../../../../services/comment.service';
import { ImageCompressionService } from '../../../../services/image-compression.service';
import { PostComponent } from '../post/post.component';
import { User } from '../../../../models/user.model';
import { EmojiPickerService } from '../../../../services/emoji-picker.service';
import { HashtagService, HashtagResult } from '../../../../services/hashtag.service';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { ToastService } from '../../../../services/toast.service';


@Component({
  selector: 'app-post-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, PostComponent],
  templateUrl: './post-detail.component.html',
  styles: []
})
export class PostDetailComponent implements OnInit, OnDestroy {
  @ViewChild('postContainer') postContainer!: ElementRef;
  @ViewChild('mainPost') mainPostElement!: ElementRef;
  @ViewChild('replyTextarea') replyTextarea!: ElementRef;

  post: Post | null = null;
  replies: Post[] = [];
  parentChain: Post[] = [];
  postId: number = 0;
  handle: string = '';
  loading: boolean = true;
  error: string | null = null;
  newReply = '';
  replyFocused = false;
  currentUser: User | null = null;
  showEmojiPicker = false;
  emojiPickerPosition = { top: 0, left: 0 };
  emojiPickerOpen = false;
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';
  public images: { id: string, file: File, preview: string }[] = [];
  isPWAMode = false;

  // Hashtag autocomplete properties
  protected hashtagSuggestions: HashtagResult[] = [];
  protected showHashtagDropdown = false;
  protected selectedHashtagIndex = 0;
  protected currentHashtagQuery = '';
  protected hashtagDropdownPosition = { top: 0, left: 0 };
  private hashtagSubscription?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private postService: PostService,
    private commentService: CommentService,
    public authService: AuthService,
    private imageCompressionService: ImageCompressionService,
    private location: Location,
    private emojiPickerService: EmojiPickerService,
    private hashtagService: HashtagService,
    private toastService: ToastService
  ) {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  ngOnInit() {
    // Check if running as PWA
    this.isPWAMode = window.matchMedia('(display-mode: standalone)').matches;
    
    // Listen for PWA mode changes
    window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
      this.isPWAMode = e.matches;
    });
    
    this.route.params.subscribe(params => {
      this.loading = true;
      this.error = null;
      this.handle = params['handle'];
      this.postId = +params['id'];
      this.loadPost();
    });
    
    // Subscribe to emoji picker state
    this.emojiPickerService.pickerState$.subscribe(state => {
      this.emojiPickerOpen = state.show;
    });
  }

  ngAfterViewInit() {
    this.adjustTextareaHeight();

    this.scrollToMainPost();
  }

  ngOnDestroy(): void {
    // Clean up any subscriptions or resources if needed
  }

  adjustTextareaHeight() {
    const textarea = this.replyTextarea?.nativeElement;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    }
  }

  onTextareaInput() {
    this.adjustTextareaHeight();
    
    // Check for hashtag autocomplete
    this.checkForHashtagAutocomplete();
  }

  loadReplies(): void {
    if (!this.post) return;
    
    this.commentService.getComments(this.post.author.handle, this.post.id).subscribe({
      next: (replies) => {
        // Filter out replies that are removed, deleted, or have invalid conversation chains
        this.replies = replies.filter(reply => !this.shouldHidePost(reply));
      },
      error: (error: Error) => {
        console.error('Error loading replies:', error);
      }
    });
  }

  submitReply(): void {
    if (!this.post || this.shouldHidePost(this.post) || (!this.newReply.trim() && this.images.length === 0)) return;

    const imageFiles = this.images.map(img => img.file);

    this.postService.createReply(this.post.author.handle, this.post.id, this.newReply, imageFiles).subscribe({
      next: (reply) => {
        this.replies.unshift(reply);
        this.newReply = '';
        this.images.forEach(img => {
          URL.revokeObjectURL(img.preview);
        });
        this.images = [];
        this.replyFocused = false;
        this.showEmojiPicker = false;
        if (this.post) {
          this.post.replies_count = (this.post.replies_count || 0) + 1;
        }
      },
      error: (error: Error) => {
        console.error('Error creating reply:', error);
      }
    });
  }

  likeReply(reply: Post): void {
    if (!this.post) return;

    this.postService.likePost(reply.author.handle, reply.id).subscribe({
      next: () => {
        reply.is_liked = !reply.is_liked;
        reply.likes_count = (reply.likes_count || 0) + (reply.is_liked ? 1 : -1);
      },
      error: (error: Error) => {
        console.error('Error liking reply:', error);
      }
    });
  }

  goBack(): void {
    this.location.back();
  }

  toggleLike(): void {
    if (!this.post || this.shouldHidePost(this.post)) return;

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
    if (!this.post || this.shouldHidePost(this.post)) return;

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

  // Wire child post actions to existing service methods
  onLikeFromChild(target: Post): void {
    if (this.shouldHidePost(target)) return;
    
    const isRepost = target.post_type === 'repost' && !!target.referenced_post;
    const objToUpdate = isRepost ? target.referenced_post! : target;
    if (this.shouldHidePost(objToUpdate)) return;
    
    const prevLiked = !!objToUpdate.is_liked;
    const prevCount = objToUpdate.likes_count || 0;

    // Optimistic UI update
    objToUpdate.is_liked = !prevLiked;
    objToUpdate.likes_count = prevCount + (objToUpdate.is_liked ? 1 : -1);

    this.postService.likePost(objToUpdate.author.handle, objToUpdate.id).subscribe({
      error: () => {
        // Revert on error
        objToUpdate.is_liked = prevLiked;
        objToUpdate.likes_count = prevCount;
        this.toastService.showError('Failed to update like');
      }
    });
  }

  onRepostFromChild(target: Post): void {
    if (this.shouldHidePost(target)) return;
    
    const isRepost = target.post_type === 'repost' && !!target.referenced_post;
    const objToUpdate = isRepost ? target.referenced_post! : target;
    if (this.shouldHidePost(objToUpdate)) return;
    
    const prevReposted = !!objToUpdate.is_reposted;
    const prevCount = objToUpdate.reposts_count || 0;

    // Optimistic UI update
    objToUpdate.is_reposted = !prevReposted;
    objToUpdate.reposts_count = prevCount + (objToUpdate.is_reposted ? 1 : -1);

    this.postService.repostPost(objToUpdate.author.handle, objToUpdate.id.toString()).subscribe({
      error: () => {
        // Revert on error
        objToUpdate.is_reposted = prevReposted;
        objToUpdate.reposts_count = prevCount;
        this.toastService.showError('Failed to repost');
      }
    });
  }

  onBookmarkFromChild(target: Post): void {
    if (this.shouldHidePost(target)) return;
    
    const isRepost = target.post_type === 'repost' && !!target.referenced_post;
    const objToUpdate = isRepost ? target.referenced_post! : target;
    if (this.shouldHidePost(objToUpdate)) return;
    
    const prevBookmarked = !!objToUpdate.is_bookmarked;

    // Optimistic UI update
    objToUpdate.is_bookmarked = !prevBookmarked;

    this.postService.bookmarkPost(objToUpdate.author.handle, objToUpdate.id).subscribe({
      error: () => {
        // Revert on error
        objToUpdate.is_bookmarked = prevBookmarked;
        this.toastService.showError('Failed to update bookmark');
      }
    });
  }

  onPostUpdated(): void {
    // Post is already updated via PostUpdateService
  }

  toggleEmojiPicker(event: MouseEvent) {
    event.stopPropagation();
    this.emojiPickerService.showPicker(event, event.target as HTMLElement, (emoji: any) => {
      this.newReply += emoji.emoji.native;
    });
  }

  loadPost() {

    this.loading = true;
    this.error = '';
    
    if (this.postId && this.handle) {
      this.postService.getPost(this.handle, this.postId).subscribe({
                 next: (post) => {
           // Check if this post is removed, deleted, or has invalid conversation chain
           if (this.shouldHidePost(post)) {
             this.post = null;
             this.loading = false;
             
             // Determine the type of post that was removed, deleted, or has invalid conversation chain
             let errorMessage = 'This post has been removed due to violations.';
             
             // Check if this is a repost/quote with a deleted referenced post
             if ((post.post_type === 'repost' || post.post_type === 'quote') && 
                 post.referenced_post && post.referenced_post.is_deleted === true) {
               errorMessage = 'This post references content that has been deleted by the author.';
             } else if (post.is_deleted === true) {
               errorMessage = 'This post has been deleted by the author.';
             } else if (post.is_removed === true) {
               errorMessage = 'This post has been removed due to violations.';
             } else if (post.is_conversation_chain_valid === false) {
               errorMessage = 'This post is part of a conversation that contains deleted or removed content.';
             }
             
             this.error = errorMessage;
             return;
           }

          this.post = post;
          this.loading = false;
          
          // Build parent chain if this is a reply
          if (post.post_type === 'reply') {

            this.buildParentChain(post);
          } else {

            this.parentChain = [];
          }
          
          // Load replies
          this.loadReplies();
          
          // Try scrolling immediately after post load
          this.scrollToMainPost();
        },
                 error: (error) => {
           console.error('Error loading post:', error);
           this.loading = false;
           
           // Handle different error types
           if (error.status === 404) {
             this.error = 'This post has been deleted, removed, or is part of an invalid conversation.';
           } else {
             this.error = 'Failed to load post. Please try again.';
           }
         }
      });
    } else {
      this.error = 'Invalid post URL';
      this.loading = false;
    }
  }

  private async buildParentChain(post: Post) {

    
    // Clear existing chain
    this.parentChain = [];

    // Use conversation_chain to build the parent chain
    if (post.conversation_chain && post.conversation_chain.length > 0) {
      // Get all posts except the last one (which is the current post)
      const chainIds = post.conversation_chain.slice(0, -1);

      
                for (const postId of chainIds) {
            try {
              // Use getPostById instead of getPost since parent posts can be from different users
              const chainPost = await this.postService.getPostById(postId).toPromise();
              if (chainPost && !this.shouldHidePost(chainPost)) {

                this.parentChain.push(chainPost);
              }
            } catch (error) {
              console.error(`Error loading parent post ${postId}:`, error);
            }
          }
    }


  }

  private isPostRemovedOrDeleted(post: Post): boolean {
    // Check if the post itself is removed or deleted
    if (post.is_removed === true || post.is_deleted === true) {
      return true;
    }
    
    // For reposts and quotes, also check if their referenced post is removed or deleted
    if ((post.post_type === 'repost' || post.post_type === 'quote') && post.referenced_post) {
      if (post.referenced_post.is_removed === true || post.referenced_post.is_deleted === true) {
        return true;
      }
    }
    
    return false;
  }

  private isPostConversationChainInvalid(post: Post): boolean {
    // Check if the post has an invalid conversation chain
    if (post.is_conversation_chain_valid === false) {
      return true;
    }
    
    return false;
  }

  private shouldHidePost(post: Post): boolean {
    // Check if post should be hidden due to being removed, deleted, or having invalid conversation chain
    return this.isPostRemovedOrDeleted(post) || this.isPostConversationChainInvalid(post);
  }

  getConnectingLineHeight(index: number): number {
    // Get the height of the post element
    const postElements = document.querySelectorAll('.post-container');
    if (postElements[index]) {
      return postElements[index].clientHeight;
    }
    return 100; // Default height
  }

  getMainPostLineHeight(): string {
    return '100%';
  }

  getReplyLineHeight(index: number): string {
    return '100%';
  }

  private scrollToMainPost() {
    // Only scroll if this is a reply post
    if (this.post?.post_type === 'reply') {

      
      const tryScroll = () => {
        if (!this.mainPostElement?.nativeElement) {

          return;
        }

        const element = this.mainPostElement.nativeElement;
        const rect = element.getBoundingClientRect();


        const position = rect.top + window.pageYOffset;
        

        window.scrollTo({
          top: position,
          behavior: 'instant'
        });
      };

      // Try immediately and then once more after a very short delay
      tryScroll();
      requestAnimationFrame(() => {
        tryScroll();
      });
    }
  }

  onPhotoClick(event: MouseEvent): void {

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const files = target.files;
      
      if (files) {
        const newFiles = Array.from(files).slice(0, 4 - this.images.length);
        
        // Compress images before adding
        const compressedFiles = await Promise.all(
          newFiles.map(file => this.imageCompressionService.compressImage(file, 'POST'))
        );
        
        compressedFiles.forEach(file => {
          const id = Math.random().toString(36).substring(7);
          this.images.push({
            id,
            file,
            preview: URL.createObjectURL(file)
          });
        });
      }
    };
    
    input.click();
  }

  removeImage(id: string): void {
    const image = this.images.find(img => img.id === id);
    if (image) {
      URL.revokeObjectURL(image.preview);
      this.images = this.images.filter(img => img.id !== id);
    }
  }

  protected getImageLayoutClass(index: number): string {
    if (this.images.length === 1) return 'w-full h-full';
    if (this.images.length === 2) return 'w-1/2 h-full';
    if (this.images.length === 3) return 'w-1/2 h-full';
    if (this.images.length === 4) return 'w-1/2 h-1/2';
    return '';
  }

  onPostReported(postId: number): void {
    // If the main post is reported, navigate away
    if (this.post && this.post.id === postId) {
      this.goBack();
      return;
    }

    // Remove reported post from parent chain
    this.parentChain = this.parentChain.filter(post => post.id !== postId);
    
    // Remove reported post from replies
    this.replies = this.replies.filter(post => post.id !== postId);
  }

  protected closeEmojiPickerBackdrop(): void {
    this.emojiPickerService.hidePicker();
  }

  // Hashtag autocomplete methods
  private checkForHashtagAutocomplete(): void {
    const textarea = this.replyTextarea?.nativeElement;
    if (!textarea) return;

    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = this.newReply.substring(0, cursorPosition);
    
    // Find the last hashtag before cursor
    const hashtagMatch = textBeforeCursor.match(/#(\w*)$/);
    
    if (hashtagMatch) {
      const hashtagQuery = hashtagMatch[1];
      this.currentHashtagQuery = hashtagQuery;
      
      if (hashtagQuery.length >= 1) {
        this.showHashtagSuggestions(hashtagQuery);
        this.positionHashtagDropdown();
      } else {
        this.hideHashtagDropdown();
      }
    } else {
      this.hideHashtagDropdown();
    }
  }

  private showHashtagSuggestions(query: string): void {
    // Cancel previous subscription
    if (this.hashtagSubscription) {
      this.hashtagSubscription.unsubscribe();
    }

    // Search for hashtags with debounce
    this.hashtagSubscription = this.hashtagService.searchHashtags(query)
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe({
        next: (response) => {
          this.hashtagSuggestions = response.results.slice(0, 5); // Limit to 5 suggestions
          this.showHashtagDropdown = this.hashtagSuggestions.length > 0;
          this.selectedHashtagIndex = 0;
        },
        error: (error) => {
          console.error('Error fetching hashtag suggestions:', error);
          this.hideHashtagDropdown();
        }
      });
  }

  private positionHashtagDropdown(): void {
    const textarea = this.replyTextarea?.nativeElement;
    if (!textarea) return;

    const rect = textarea.getBoundingClientRect();
    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = this.newReply.substring(0, cursorPosition);
    
    // Calculate position based on cursor
    const textareaStyle = window.getComputedStyle(textarea);
    const lineHeight = parseInt(textareaStyle.lineHeight);
    const lines = textBeforeCursor.split('\n');
    const currentLine = lines[lines.length - 1];
    
    // Estimate cursor position
    const estimatedCursorX = currentLine.length * 8; // Rough estimate
    const estimatedCursorY = (lines.length - 1) * lineHeight;
    
    this.hashtagDropdownPosition = {
      top: rect.top + estimatedCursorY + lineHeight,
      left: rect.left + Math.min(estimatedCursorX, rect.width - 200)
    };
  }

  private hideHashtagDropdown(): void {
    this.showHashtagDropdown = false;
    this.hashtagSuggestions = [];
    this.selectedHashtagIndex = 0;
  }

  protected selectHashtag(hashtag: HashtagResult): void {
    const textarea = this.replyTextarea?.nativeElement;
    if (!textarea) return;

    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = this.newReply.substring(0, cursorPosition);
    
    // Find the hashtag to replace
    const hashtagMatch = textBeforeCursor.match(/#(\w*)$/);
    if (hashtagMatch) {
      const startPos = cursorPosition - hashtagMatch[0].length;
      const endPos = cursorPosition;
      
      // Replace the partial hashtag with the full one
      const newContent = this.newReply.substring(0, startPos) + 
                        '#' + hashtag.name + 
                        this.newReply.substring(endPos);
      
      this.newReply = newContent;
      
      // Set cursor position after the hashtag
      const newCursorPos = startPos + hashtag.name.length + 1;
      setTimeout(() => {
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      });
    }
    
    this.hideHashtagDropdown();
  }

  protected onHashtagKeydown(event: KeyboardEvent): void {
    if (!this.showHashtagDropdown) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedHashtagIndex = Math.min(
          this.selectedHashtagIndex + 1, 
          this.hashtagSuggestions.length - 1
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.selectedHashtagIndex = Math.max(this.selectedHashtagIndex - 1, 0);
        break;
      case 'Enter':
        event.preventDefault();
        if (this.hashtagSuggestions[this.selectedHashtagIndex]) {
          this.selectHashtag(this.hashtagSuggestions[this.selectedHashtagIndex]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        this.hideHashtagDropdown();
        break;
    }
  }
} 