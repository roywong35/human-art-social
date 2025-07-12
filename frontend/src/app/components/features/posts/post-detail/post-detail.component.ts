import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule, DatePipe, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Post } from '../../../../models/post.model';
import { PostService } from '../../../../services/post.service';
import { AuthService } from '../../../../services/auth.service';
import { CommentService } from '../../../../services/comment.service';
import { PostComponent } from '../post/post.component';
import { User } from '../../../../models/user.model';
import { EmojiPickerService } from '../../../../services/emoji-picker.service';


@Component({
  selector: 'app-post-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, PostComponent],
  templateUrl: './post-detail.component.html',
  styles: []
})
export class PostDetailComponent implements OnInit, AfterViewInit {
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
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';
  public images: { id: string, file: File, preview: string }[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private postService: PostService,
    private commentService: CommentService,
    public authService: AuthService,
    private location: Location,
    private emojiPickerService: EmojiPickerService
  ) {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.loading = true;
      this.error = null;
      this.handle = params['handle'];
      this.postId = +params['id'];
      this.loadPost();
    });
  }

  ngAfterViewInit() {
    this.adjustTextareaHeight();
    console.log('ngAfterViewInit called');
    console.log('Post type:', this.post?.post_type);
    this.scrollToMainPost();
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
  }

  loadReplies(): void {
    if (!this.post) return;
    
    this.commentService.getComments(this.post.author.handle, this.post.id).subscribe({
      next: (replies) => {
        this.replies = replies;
      },
      error: (error: Error) => {
        console.error('Error loading replies:', error);
      }
    });
  }

  submitReply(): void {
    if (!this.post || (!this.newReply.trim() && this.images.length === 0)) return;

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

  toggleEmojiPicker(event: MouseEvent) {
    event.stopPropagation();
    this.emojiPickerService.showPicker(event, event.target as HTMLElement, (emoji: any) => {
      this.newReply += emoji.emoji.native;
    });
  }

  loadPost() {
    console.log('Loading post...');
    this.loading = true;
    this.error = '';
    
    if (this.postId && this.handle) {
      this.postService.getPost(this.handle, this.postId).subscribe({
        next: (post) => {
          console.log('Post loaded:', post);
          this.post = post;
          this.loading = false;
          
          // Build parent chain if this is a reply
          if (post.post_type === 'reply') {
            console.log('This is a reply post, building parent chain');
            this.buildParentChain(post);
          } else {
            console.log('This is a main post, no parent chain needed');
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
          this.error = 'Failed to load post. Please try again.';
        }
      });
    } else {
      this.error = 'Invalid post URL';
      this.loading = false;
    }
  }

  private async buildParentChain(post: Post) {
    console.log('Building parent chain for post:', post.id);
    
    // Clear existing chain
    this.parentChain = [];

    // Use conversation_chain to build the parent chain
    if (post.conversation_chain && post.conversation_chain.length > 0) {
      // Get all posts except the last one (which is the current post)
      const chainIds = post.conversation_chain.slice(0, -1);
      console.log('Using conversation chain:', chainIds);
      
      for (const postId of chainIds) {
        try {
          // Use getPostById instead of getPost since parent posts can be from different users
          const chainPost = await this.postService.getPostById(postId).toPromise();
          if (chainPost) {
            console.log('Added parent to chain:', chainPost.id);
            this.parentChain.push(chainPost);
          }
        } catch (error) {
          console.error(`Error loading parent post ${postId}:`, error);
        }
      }
    }

    console.log('Final parent chain:', this.parentChain.map(p => p.id));
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
      console.log('Post is a reply, attempting to scroll');
      
      const tryScroll = () => {
        if (!this.mainPostElement?.nativeElement) {
          console.log('Main post element not found');
          return;
        }

        const element = this.mainPostElement.nativeElement;
        const rect = element.getBoundingClientRect();
        console.log('Element position:', {
          top: rect.top,
          pageYOffset: window.pageYOffset,
          elementOffsetTop: element.offsetTop
        });

        const position = rect.top + window.pageYOffset;
        
        console.log('Scrolling to position:', position);
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
    console.log('Photo click handler called');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const files = target.files;
      
      if (files) {
        console.log('Files selected:', files);
        const newFiles = Array.from(files).slice(0, 4 - this.images.length);
        newFiles.forEach(file => {
          const id = Math.random().toString(36).substring(7);
          this.images.push({
            id,
            file,
            preview: URL.createObjectURL(file)
          });
        });
        console.log('Images array after adding:', this.images);
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

} 