import { Component, OnInit, QueryList, ViewChildren, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PostComponent } from '../../features/posts/post/post.component';
import { CommentComponent } from '../../features/comments/comment/comment.component';
import { Post } from '../../../models/post.model';
import { BookmarkService } from '../../../services/bookmark.service';
import { PostService } from '../../../services/post.service';
import { ToastService } from '../../../services/toast.service';


@Component({
  selector: 'app-bookmarks',
  standalone: true,
  imports: [CommonModule, PostComponent, CommentComponent],
  templateUrl: './bookmarks.component.html',
  styleUrls: ['./bookmarks.component.scss']
})
export class BookmarksComponent implements OnInit {
  @ViewChildren(PostComponent) postComponents!: QueryList<PostComponent>;
  bookmarkedItems: any[] = [];
  loading = true;
  error: string | null = null;

  constructor(
    private bookmarkService: BookmarkService,
    private postService: PostService,
    private ngZone: NgZone,
    private cd: ChangeDetectorRef,
    private toastService: ToastService
  ) {}

  ngOnInit() {
    this.loadBookmarks();
  }

  // Check if a post has any bookmarked comments
  hasBookmarkedComments(postId: number): boolean {
    return this.bookmarkedItems.some(item => 
      item.type === 'comment' && item.item.post_id === postId
    );
  }

  // Remove an item from the bookmarked items list
  removeFromBookmarks(type: 'post' | 'comment', id: number) {
    // For both posts and comments, just remove them locally
    if (type === 'post') {
      this.bookmarkedItems = this.bookmarkedItems.filter(item => 
        item.type !== 'post' || item.item.id !== id
      );
    } else {
      this.bookmarkedItems = this.bookmarkedItems.filter(item => 
        !(item.type === 'comment' && item.item.id === id)
      );
    }
  }

  // Handle post bookmark update
  onPostBookmarkUpdate(event: any) {

    if (!event.is_bookmarked) {
      this.removeFromBookmarks('post', event.id);
    }
  }

  // Handle comment bookmark update
  onCommentBookmarkUpdate(event: any) {

    if (!event.is_bookmarked) {
      this.removeFromBookmarks('comment', event.id);
    }
  }

  loadBookmarks() {
    this.loading = true;
    this.error = null;
    
    this.bookmarkService.getBookmarkedPosts().subscribe({
      next: (posts) => {

        
        // Create a combined list of bookmarked items
        this.bookmarkedItems = [];
        
        posts.forEach(post => {

          
          // Only add posts that are explicitly bookmarked by the user
          if (post.is_bookmarked === true) {

            this.bookmarkedItems.push({
              type: 'post',
              item: post,
              bookmarked_at: (post as any).bookmarked_at || post.created_at
            });
          }
          
          // Add bookmarked comments
          const comments = (post as any).bookmarked_comments || [];
          if (comments.length > 0) {

          }
          comments.forEach((comment: any) => {
            // Ensure the comment has the post ID
            comment.post_id = post.id;
            this.bookmarkedItems.push({
              type: 'comment',
              item: comment,
              bookmarked_at: comment.bookmarked_at || comment.created_at
            });
          });
        });
        
        // Sort all items by bookmark time
        this.bookmarkedItems.sort((a, b) => 
          new Date(b.bookmarked_at).getTime() - new Date(a.bookmarked_at).getTime()
        );


        
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading bookmarks:', error);
        this.error = 'Failed to load bookmarks. Please try again later.';
        this.loading = false;
      }
    });
  }

  refreshContent() {
    this.loadBookmarks();
  }

  onLike(post: Post): void {
    const originalPost = post.post_type === 'repost' ? post.referenced_post! : post;
    const prevLiked = !!originalPost.is_liked;
    const prevCount = originalPost.likes_count || 0;

    // Optimistic UI update across bookmarked items
    this.ngZone.run(() => {
      this.bookmarkedItems.forEach(p => {
        if (p.type === 'post') {
          if (p.item.id === originalPost.id) {
            p.item.is_liked = !prevLiked;
            p.item.likes_count = prevCount + (p.item.is_liked ? 1 : -1);
          }
          if (p.item.post_type === 'repost' && p.item.referenced_post?.id === originalPost.id) {
            p.item.referenced_post.is_liked = !prevLiked;
            p.item.referenced_post.likes_count = prevCount + (p.item.referenced_post.is_liked ? 1 : -1);
          }
        }
      });
      // Force update on visible post components
      this.postComponents?.forEach(pc => {
        if (pc.post.id === originalPost.id || (pc.post.post_type === 'repost' && pc.post.referenced_post?.id === originalPost.id)) {
          pc.forceUpdate();
        }
      });
      this.cd.markForCheck();
    });

    // Backend call; revert on error
    this.postService.likePost(originalPost.author.handle, originalPost.id).subscribe({
      error: () => {
        this.ngZone.run(() => {
          this.bookmarkedItems.forEach(p => {
            if (p.type === 'post') {
              if (p.item.id === originalPost.id) {
                p.item.is_liked = prevLiked;
                p.item.likes_count = prevCount;
              }
              if (p.item.post_type === 'repost' && p.item.referenced_post?.id === originalPost.id) {
                p.item.referenced_post.is_liked = prevLiked;
                p.item.referenced_post.likes_count = prevCount;
              }
            }
          });
          this.postComponents?.forEach(pc => {
            if (pc.post.id === originalPost.id || (pc.post.post_type === 'repost' && pc.post.referenced_post?.id === originalPost.id)) {
              pc.forceUpdate();
            }
          });
          this.cd.markForCheck();
        });
      }
    });
  }

  onRepost(post: Post): void {
    const originalPost = post.post_type === 'repost' ? post.referenced_post! : post;
    const prevReposted = !!originalPost.is_reposted;
    const prevCount = originalPost.reposts_count || 0;

    // Optimistic
    this.ngZone.run(() => {
      this.bookmarkedItems.forEach(p => {
        if (p.type === 'post') {
          if (p.item.id === originalPost.id) {
            p.item.is_reposted = !prevReposted;
            p.item.reposts_count = prevCount + (p.item.is_reposted ? 1 : -1);
          }
          if (p.item.post_type === 'repost' && p.item.referenced_post?.id === originalPost.id) {
            p.item.referenced_post.is_reposted = !prevReposted;
            p.item.referenced_post.reposts_count = prevCount + (p.item.referenced_post.is_reposted ? 1 : -1);
          }
        }
      });
      this.postComponents?.forEach(pc => {
        if (pc.post.id === originalPost.id || (pc.post.post_type === 'repost' && pc.post.referenced_post?.id === originalPost.id)) {
          pc.forceUpdate();
        }
      });
      this.cd.markForCheck();
    });

    this.postService.repost(originalPost.author.handle, originalPost.id).subscribe({
      error: () => {
        // Revert on error
        this.ngZone.run(() => {
          this.bookmarkedItems.forEach(p => {
            if (p.type === 'post') {
              if (p.item.id === originalPost.id) {
                p.item.is_reposted = prevReposted;
                p.item.reposts_count = prevCount;
              }
              if (p.item.post_type === 'repost' && p.item.referenced_post?.id === originalPost.id) {
                p.item.referenced_post.is_reposted = prevReposted;
                p.item.referenced_post.reposts_count = prevCount;
              }
            }
          });
          this.postComponents?.forEach(pc => {
            if (pc.post.id === originalPost.id || (pc.post.post_type === 'repost' && pc.post.referenced_post?.id === originalPost.id)) {
              pc.forceUpdate();
            }
          });
          this.cd.markForCheck();
        });
      }
    });
  }

  onBookmark(post: Post): void {
    const originalPost = post.post_type === 'repost' ? post.referenced_post! : post;
    const prevBookmarked = !!originalPost.is_bookmarked;

    // Optimistic: remove from bookmarks immediately since we're in the bookmarks page
    this.ngZone.run(() => {
      // Remove the item from the bookmarks list immediately
      this.bookmarkedItems = this.bookmarkedItems.filter(item => 
        !(item.type === 'post' && (
          item.item.id === originalPost.id || 
          (item.item.post_type === 'repost' && item.item.referenced_post?.id === originalPost.id)
        ))
      );
      this.cd.markForCheck();
    });

    // Call the bookmark service
    this.bookmarkService.toggleBookmark(originalPost.author.handle, originalPost.id).subscribe({
      error: () => {
        // On error, refresh the entire content to restore the correct state
        this.toastService.showError('Failed to update bookmark');
        this.loadBookmarks();
      }
    });
  }

  onPostReported(postId: number): void {
    // Remove the reported post from bookmarks
    this.bookmarkedItems = this.bookmarkedItems.filter(item => 
      !(item.type === 'post' && item.item.id === postId)
    );
  }
} 