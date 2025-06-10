import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CommentService } from '../../services/comment.service';
import { PostService } from '../../services/post.service';
import { AuthService } from '../../services/auth.service';
import { Comment } from '../../models/comment.model';
import { Post } from '../../models/post.model';
import { TimeAgoPipe } from '../../pipes/time-ago.pipe';
import { CommentComponent } from '../shared/comment/comment.component';
import { PostComponent } from '../shared/post/post.component';
import { PostInputBoxComponent } from '../shared/post-input-box/post-input-box.component';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-comment-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, TimeAgoPipe, CommentComponent, PostComponent, PostInputBoxComponent],
  templateUrl: './comment-detail.component.html'
})
export class CommentDetailComponent implements OnInit {
  comment: Comment | null = null;
  parentChain: Comment[] = [];
  replies: Comment[] = [];
  replyContent = '';
  currentUser: User | null = null;
  postId: number = 0;
  post: Post | null = null;
  isReplyFocused = false;
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';
  commentId: number = 0;
  handle: string = '';
  loading = true;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private commentService: CommentService,
    private postService: PostService,
    private authService: AuthService
  ) {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      if (params['postId'] && params['commentId'] && params['handle']) {
        this.postId = +params['postId'];
        this.commentId = +params['commentId'];
        this.handle = params['handle'];
        this.loadComment();
      }
    });
  }

  loadComment(): void {
    this.loading = true;
    this.error = null;

    // First load the post
    this.postService.getPost(this.handle, this.postId).subscribe({
      next: (post) => {
        this.post = post;
        
        // Then load the comment
        this.commentService.getComment(this.handle, this.postId, this.commentId).subscribe({
          next: (comment) => {
            this.comment = comment;
            this.loading = false;
            
            // Load parent chain if this is a reply
            if (comment.parent_comment_id) {
              this.loadParentChain();
            }
            
            // Load replies
            this.loadReplies();
          },
          error: (error: Error) => {
            console.error('Error loading comment:', error);
            this.error = 'Failed to load comment. Please try again.';
            this.loading = false;
          }
        });
      },
      error: (error: Error) => {
        console.error('Error loading post:', error);
        this.error = 'Failed to load post. Please try again.';
        this.loading = false;
      }
    });
  }

  loadCommentWithParentChain(postId: number, commentId: number): void {
    this.postId = postId;
    this.commentId = commentId;
    this.loadComment();
  }

  loadParentChain(): void {
    if (!this.comment) return;
    this.commentService.getParentChain(this.handle, this.postId, this.commentId).subscribe({
      next: (comments: Comment[]) => {
        this.parentChain = comments;
      },
      error: (error: Error) => {
        console.error('Error loading parent chain:', error);
      }
    });
  }

  loadReplies(): void {
    if (!this.comment) return;
    this.commentService.getReplies(this.handle, this.postId, this.commentId).subscribe({
      next: (replies: Comment[]) => {
        this.replies = replies;
      },
      error: (error: Error) => {
        console.error('Error loading replies:', error);
      }
    });
  }

  onCommentSubmit(data: { content: string, image?: File }): void {
    if (!data.content.trim() && !data.image) return;

    this.commentService.createComment(this.handle, this.postId, data.content).subscribe({
      next: (comment) => {
        this.replies = [comment, ...this.replies];
        if (this.post) {
          this.post.comments_count = (this.post.comments_count || 0) + 1;
        }
      },
      error: (error: Error) => {
        console.error('Error creating comment:', error);
      }
    });
  }

  onLike(): void {
    if (!this.comment) return;

    this.commentService.likeComment(this.handle, this.postId, this.comment.id).subscribe({
      next: () => {
        if (this.comment) {
          this.comment.is_liked = !this.comment.is_liked;
          this.comment.likes_count = (this.comment.likes_count || 0) + (this.comment.is_liked ? 1 : -1);
        }
      },
      error: (error: Error) => console.error('Error liking comment:', error)
    });
  }

  onRepost(): void {
    if (!this.comment) return;

    this.commentService.repostComment(this.handle, this.postId, this.comment.id).subscribe({
      next: () => {
        if (this.comment) {
          this.comment.is_reposted = !this.comment.is_reposted;
          this.comment.reposts_count = (this.comment.reposts_count || 0) + (this.comment.is_reposted ? 1 : -1);
        }
      },
      error: (error: Error) => console.error('Error reposting comment:', error)
    });
  }

  onShare(): void {
    if (!this.comment) return;
    const url = `${window.location.origin}/${this.handle}/post/${this.postId}/comment/${this.comment.id}`;
    navigator.clipboard.writeText(url).then(() => {
      // TODO: Show a toast notification
      console.log('Comment URL copied to clipboard');
    });
  }

  onBookmark(): void {
    if (!this.comment) return;
    this.commentService.bookmarkComment(this.handle, this.postId, this.comment.id).subscribe({
      next: () => {
        if (this.comment) {
          this.comment.is_bookmarked = !this.comment.is_bookmarked;
        }
      },
      error: (error: Error) => console.error('Error bookmarking comment:', error)
    });
  }

  goBack(): void {
    const handle = this.post?.author.handle;
    if (handle) {
      this.router.navigate([`/${handle}/post`, this.postId]);
    } else {
      this.router.navigate(['/']);
    }
  }
} 