import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule, DatePipe, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Post } from '../../models/post.model';
import { Comment } from '../../models/comment.model';
import { PostService } from '../../services/post.service';
import { AuthService } from '../../services/auth.service';
import { CommentService } from '../../services/comment.service';
import { PostComponent } from '../shared/post/post.component';
import { User } from '../../models/user.model';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';

@Component({
  selector: 'app-post-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, PostComponent, PickerComponent],
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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private postService: PostService,
    private commentService: CommentService,
    public authService: AuthService,
    private location: Location
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
    if (!this.post || !this.newReply.trim()) return;

    this.commentService.createComment(this.post.author.handle, this.post.id, this.newReply).subscribe({
      next: (reply) => {
        this.replies.unshift(reply);
        this.newReply = '';
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

  toggleEmojiPicker(event: MouseEvent): void {
    event.stopPropagation();
    this.showEmojiPicker = !this.showEmojiPicker;
    if (this.showEmojiPicker) {
      const button = event.currentTarget as HTMLElement;
      const rect = button.getBoundingClientRect();
      this.emojiPickerPosition = {
        top: rect.bottom + window.scrollY + 10,
        left: rect.left + window.scrollX - 320
      };
    }
  }

  onEmojiSelect(event: any): void {
    const emoji = event.emoji.native;
    const textarea = this.replyTextarea.nativeElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    this.newReply = 
      this.newReply.substring(0, start) + 
      emoji +
      this.newReply.substring(end);
    
    // Set cursor position after emoji
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
      textarea.focus();
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

    // If we have conversation_chain, use it
    if (post.conversation_chain && post.conversation_chain.length > 1) {
      const chainIds = post.conversation_chain.slice(0, -1);
      console.log('Using conversation chain:', chainIds);
      
      for (const postId of chainIds) {
        try {
          const chainPost = await this.postService.getPost(this.handle, postId).toPromise();
          if (chainPost) {
            console.log('Added parent to chain:', chainPost.id);
            this.parentChain.push(chainPost);
          }
        } catch (error) {
          console.error(`Error loading parent post ${postId}:`, error);
        }
      }
    }
    // Otherwise, build chain using parent_post relationships
    else if (post.parent_post) {
      console.log('Building chain from parent relationships');
      let currentPost: Post | null = post.parent_post;
      
      // Keep adding parents until we reach the top
      while (currentPost) {
        console.log('Added parent to chain:', currentPost.id);
        this.parentChain.unshift(currentPost);
        currentPost = currentPost.parent_post || null;
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
    event.stopPropagation();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = (e: any) => {
      const files = e.target.files;
      if (files) {
        // Handle the selected photos
        // You can implement the photo handling logic here
        console.log('Selected photos:', files);
      }
    };
    input.click();
  }


} 