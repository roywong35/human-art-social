import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PostComponent } from '../../features/posts/post/post.component';
import { CommentComponent } from '../../features/comments/comment/comment.component';
import { Post } from '../../../models';
import { BookmarkService } from '../../../services/bookmark.service';
import { PostService } from '../../../services/post.service';


@Component({
  selector: 'app-bookmarks',
  standalone: true,
  imports: [CommonModule, PostComponent, CommentComponent],
  templateUrl: './bookmarks.component.html',
  styleUrls: ['./bookmarks.component.scss']
})
export class BookmarksComponent implements OnInit {
  bookmarkedItems: any[] = [];
  loading = true;
  error: string | null = null;

  constructor(
    private bookmarkService: BookmarkService,
    private postService: PostService
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
    this.postService.likePost(post.author.handle, post.id).subscribe({
      next: (updatedPost) => {
        const index = this.bookmarkedItems.findIndex(item => item.type === 'post' && item.item.id === post.id);
        if (index !== -1) {
          this.bookmarkedItems[index].item = updatedPost;
        }
      },
      error: (error) => console.error('Error liking post:', error)
    });
  }

  onRepost(post: Post): void {
    this.postService.repost(post.author.handle, post.id).subscribe({
      next: (response) => {
        const index = this.bookmarkedItems.findIndex(item => item.type === 'post' && item.item.id === post.id);
        if (index !== -1) {
          this.bookmarkedItems[index].item = response;
        }
      },
      error: (error) => console.error('Error reposting:', error)
    });
  }

  onPostReported(postId: number): void {
    // Remove the reported post from bookmarks
    this.bookmarkedItems = this.bookmarkedItems.filter(item => 
      !(item.type === 'post' && item.item.id === postId)
    );
  }
} 