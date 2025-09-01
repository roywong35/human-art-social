import { Component, OnInit, QueryList, ViewChildren, NgZone, ChangeDetectorRef, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PostComponent } from '../../features/posts/post/post.component';
import { CommentComponent } from '../../features/comments/comment/comment.component';
import { Post } from '../../../models/post.model';
import { BookmarkService } from '../../../services/bookmark.service';
import { PostService } from '../../../services/post.service';
import { ToastService } from '../../../services/toast.service';
import { SidebarService } from '../../../services/sidebar.service';


@Component({
  selector: 'app-bookmarks',
  standalone: true,
  imports: [CommonModule, PostComponent, CommentComponent],
  templateUrl: './bookmarks.component.html',
  styleUrls: ['./bookmarks.component.scss']
})
export class BookmarksComponent implements OnInit, OnDestroy {
  @ViewChildren(PostComponent) postComponents!: QueryList<PostComponent>;
  @ViewChild('bookmarksContainer', { static: false }) bookmarksContainer!: ElementRef;
  
  bookmarkedItems: any[] = [];
  loading = true;
  error: string | null = null;
  isRefreshing = false;
  isMobile = false;
  private hammerManager: any;

  constructor(
    private bookmarkService: BookmarkService,
    private postService: PostService,
    private ngZone: NgZone,
    private cd: ChangeDetectorRef,
    private toastService: ToastService,
    private sidebarService: SidebarService
  ) {}

  ngOnInit() {
    this.isMobile = window.innerWidth < 768;
    this.loadBookmarks();
    
    // Initialize gesture support after a short delay to ensure DOM is ready
    if (this.isMobile) {
      setTimeout(() => {
        this.initializeGestureSupport();
      }, 100);
    }
  }

  ngOnDestroy(): void {
    // Clean up Hammer.js instance if it exists
    if (this.hammerManager) {
      this.hammerManager.destroy();
    }
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
    // Only set loading to true if this is not a refresh operation and no cached content
    if (!this.isRefreshing && !this.bookmarkService.hasCachedProcessedBookmarkedItems()) {
      this.loading = true;
    }
    this.error = null;
    
    this.bookmarkService.getProcessedBookmarkedItems().subscribe({
      next: (bookmarkedItems) => {
        // Use the pre-processed items directly
        this.bookmarkedItems = bookmarkedItems;
        
        this.loading = false;
        this.isRefreshing = false;
        this.cd.markForCheck();
      },
      error: (error) => {
        console.error('Error loading bookmarks:', error);
        this.error = 'Failed to load bookmarks. Please try again later.';
        this.loading = false;
        this.isRefreshing = false;
        this.cd.markForCheck();
      }
    });
  }

  refreshContent() {
    this.loadBookmarks();
  }

  forceRefreshBookmarks() {
    // Force refresh bookmarks (for pull-to-refresh)
    this.isRefreshing = true;
    this.loading = true;
    this.bookmarkService.getProcessedBookmarkedItems(true).subscribe({
      next: (bookmarkedItems) => {
        // Use the pre-processed items directly
        this.bookmarkedItems = bookmarkedItems;
        
        this.loading = false;
        this.isRefreshing = false;
        this.cd.markForCheck();
      },
      error: (error) => {
        console.error('Error loading bookmarks:', error);
        this.error = 'Failed to load bookmarks. Please try again later.';
        this.loading = false;
        this.isRefreshing = false;
        this.cd.markForCheck();
      }
    });
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

  private initializeGestureSupport() {
    if (!this.isMobile || !this.bookmarksContainer?.nativeElement) {
      return;
    }

    // Initialize Hammer.js for swipe gestures
    if (typeof Hammer !== 'undefined') {
      this.hammerManager = new Hammer(this.bookmarksContainer.nativeElement);
      
      // Configure swipe recognition for horizontal gestures only
      this.hammerManager.get('swipe').set({ 
        direction: Hammer.DIRECTION_HORIZONTAL,
        threshold: 5,
        velocity: 0.2,
        pointers: 1
      });
      
      // Add pan recognizer for better gesture coverage
      this.hammerManager.add(new Hammer.Pan({
        direction: Hammer.DIRECTION_HORIZONTAL,
        threshold: 5,
        pointers: 1
      }));
      
      this.hammerManager.on('swiperight', () => {
        this.handleSwipeRight();
      });
      
      this.hammerManager.on('panright', (e: any) => {
        // Handle pan right as an alternative to swipe
        if (e.deltaX > 50 && e.velocity > 0.3) {
          this.handleSwipeRight();
        }
      });
    }
    
    // Setup pull-to-refresh using native touch events
    this.setupPullToRefresh();
  }

  private handleSwipeRight() {
    this.sidebarService.openSidebar();
  }

  private setupPullToRefresh() {
    let startY = 0;
    let currentY = 0;
    let isPulling = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
        isPulling = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling) return;
      
      currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;
      
      // Only allow pull down when at top of page
      if (deltaY > 0 && window.scrollY === 0) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isPulling) return;
      
      const deltaY = currentY - startY;
      
      // Trigger refresh if pulled down more than 50px
      if (deltaY > 50 && window.scrollY === 0) {
        this.pullToRefresh();
      }
      
      isPulling = false;
    };

    const container = this.bookmarksContainer?.nativeElement;
    if (container) {
      container.addEventListener('touchstart', handleTouchStart, { passive: false });
      container.addEventListener('touchmove', handleTouchMove, { passive: false });
      container.addEventListener('touchend', handleTouchEnd, { passive: true });
    }
  }

  private pullToRefresh() {
    this.isRefreshing = true;
    this.cd.markForCheck();
    
    // Force refresh the bookmarks
    this.forceRefreshBookmarks();
  }
} 