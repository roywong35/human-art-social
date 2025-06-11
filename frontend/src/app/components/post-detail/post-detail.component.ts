import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
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
  imports: [CommonModule, FormsModule, PostComponent, DatePipe, PickerComponent],
  templateUrl: './post-detail.component.html',
  styles: []
})
export class PostDetailComponent implements OnInit, AfterViewInit {
  post: Post | null = null;
  loading = true;
  error: string | null = null;
  comments: Comment[] = [];
  newComment = '';
  commentFocused = false;
  currentUser: User | null = null;
  showEmojiPicker = false;
  emojiPickerPosition = { top: 0, left: 0 };
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  @ViewChild('commentTextarea') commentTextarea!: ElementRef;

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

  ngOnInit(): void {
    const handle = this.route.snapshot.paramMap.get('handle');
    const postId = Number(this.route.snapshot.paramMap.get('id'));

    if (!handle || !postId) {
      this.error = 'Invalid post URL';
      this.loading = false;
      return;
    }

    this.postService.getPost(handle, postId).subscribe({
      next: (post) => {
        this.post = post;
        this.loading = false;
        this.loadComments();
      },
      error: (error: Error) => {
        console.error('Error loading post:', error);
        this.error = 'Failed to load post';
        this.loading = false;
      }
    });
  }

  ngAfterViewInit() {
    this.adjustTextareaHeight();
  }

  adjustTextareaHeight() {
    const textarea = this.commentTextarea?.nativeElement;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    }
  }

  onTextareaInput() {
    this.adjustTextareaHeight();
  }

  loadComments(): void {
    if (!this.post) return;
    
    this.commentService.getComments(this.post.author.handle, this.post.id).subscribe({
      next: (comments) => {
        this.comments = comments;
      },
      error: (error: Error) => {
        console.error('Error loading comments:', error);
      }
    });
  }

  submitComment(): void {
    if (!this.post || !this.newComment.trim()) return;

    this.commentService.createComment(this.post.author.handle, this.post.id, this.newComment).subscribe({
      next: (comment) => {
        this.comments.unshift(comment);
        this.newComment = '';
        this.commentFocused = false;
        this.showEmojiPicker = false;
        if (this.post) {
          this.post.comments_count = (this.post.comments_count || 0) + 1;
        }
      },
      error: (error: Error) => {
        console.error('Error creating comment:', error);
      }
    });
  }

  likeComment(comment: Comment): void {
    if (!this.post) return;

    this.commentService.likeComment(this.post.author.handle, this.post.id, comment.id).subscribe({
      next: () => {
        comment.is_liked = !comment.is_liked;
        comment.likes_count = (comment.likes_count || 0) + (comment.is_liked ? 1 : -1);
      },
      error: (error: Error) => {
        console.error('Error liking comment:', error);
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
    const textarea = this.commentTextarea.nativeElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    this.newComment = 
      this.newComment.substring(0, start) + 
      emoji +
      this.newComment.substring(end);
    
    // Set cursor position after emoji
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
      textarea.focus();
    });
  }
} 