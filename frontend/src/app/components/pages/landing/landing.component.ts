import { Component, OnInit, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PostComponent } from '../../features/posts/post/post.component';
import { SearchBarComponent } from '../../widgets/search-bar/search-bar.component';
import { PostService } from '../../../services/post.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Post } from '../../../models/post.model';
import { LoginModalComponent } from '../../features/auth/login-modal/login-modal.component';
import { AuthService } from '../../../services/auth.service';
import { MatDialog } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { RegisterModalComponent } from '../../features/auth/register-modal/register-modal.component';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PostComponent,
    SearchBarComponent,
    MatDialogModule
  ],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent implements OnInit, OnDestroy {
  posts: Post[] = [];
  activeTab: 'for-you' | 'human-drawing' = 'for-you';
  isDarkMode = false;
  
  // Infinite scroll properties
  loading = false;
  loadingMore = false;
  currentPage = 1;
  hasMore = true;
  private scrollThrottleTimeout: any;

  constructor(
    private postService: PostService,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private dialog: MatDialog
  ) {}

  ngOnDestroy() {
    // Clean up scroll throttle timeout
    if (this.scrollThrottleTimeout) {
      clearTimeout(this.scrollThrottleTimeout);
    }
  }

  @HostListener('window:scroll', ['$event'])
  onScroll(event: Event): void {
    // Throttle scroll events to improve performance
    if (this.scrollThrottleTimeout) {
      clearTimeout(this.scrollThrottleTimeout);
    }
    
    this.scrollThrottleTimeout = setTimeout(() => {
      // Check if user scrolled near bottom of page
      const scrollHeight = document.documentElement.scrollHeight;
      const scrollTop = document.documentElement.scrollTop;
      const clientHeight = document.documentElement.clientHeight;
      
      // Trigger load more when user is 200px from bottom
      const threshold = 200;
      
      if (scrollTop + clientHeight >= scrollHeight - threshold && 
          this.hasMore && 
          !this.loading && 
          !this.loadingMore) {
        console.log('🌍 Loading more public posts due to scroll');
        this.loadMore();
      }
    }, 100); // 100ms throttle
  }

  ngOnInit() {
    // Check if user is authenticated
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/home']);
      return;
    }

    // Get initial tab state from URL params
    const tabFromParams = this.route.snapshot.queryParams['tab'];
    this.activeTab = (tabFromParams || 'for-you') as 'for-you' | 'human-drawing';
    
    // Initial load of posts
    this.loadPosts();
    
    // Subscribe to future tab changes
    this.route.queryParams.subscribe(params => {
      const newTab = params['tab'] || 'for-you';
      if (this.activeTab !== newTab) {
        this.activeTab = newTab as 'for-you' | 'human-drawing';
        this.loadPosts();
      }
    });

    // Check dark mode
    this.checkDarkMode();
    const observer = new MutationObserver(() => {
      this.checkDarkMode();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
  }

  private checkDarkMode() {
    this.isDarkMode = document.documentElement.classList.contains('dark');
  }

  onTitleClick() {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/home']);
    }
  }

  setActiveTab(tab: 'for-you' | 'human-drawing'): void {
    if (this.activeTab !== tab) {
      this.activeTab = tab;
      
      // Update URL without navigation
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { tab: tab === 'for-you' ? null : tab },
        queryParamsHandling: 'merge',
        replaceUrl: true
      });

      // Reset pagination and reload posts for the new tab
      this.currentPage = 1;
      this.hasMore = true;
      this.posts = [];
      this.loadPosts();
    }
  }

  private loadPosts() {
    this.loading = true;
    this.postService.getPublicPosts(this.activeTab, this.currentPage).subscribe({
      next: response => {
        // Handle paginated response
        const posts = response.results || [];
        if (this.currentPage === 1) {
          // First page - replace posts
          this.posts = posts;
        } else {
          // Subsequent pages - append posts
          this.posts = [...this.posts, ...posts];
        }
        
        // Check if there are more posts
        this.hasMore = !!response.next;
        this.loading = false;
        this.loadingMore = false;
      },
      error: (error) => {
        console.error('Error loading public posts:', error);
        this.loading = false;
        this.loadingMore = false;
      }
    });
  }

  private loadMore() {
    if (this.loadingMore || !this.hasMore) return;
    
    this.loadingMore = true;
    this.currentPage++;
    this.loadPosts();
  }

  openLoginModal() {
    const dialogRef = this.dialog.open(LoginModalComponent, {
      width: '400px',
      panelClass: ['custom-dialog-container', 'centered-dialog'],
      disableClose: false,
      autoFocus: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // If login was successful, navigate to home
        this.router.navigate(['/home']);
      }
    });
  }

  openRegisterModal() {
    const dialogRef = this.dialog.open(RegisterModalComponent, {
      width: '450px',
      panelClass: ['custom-dialog-container', 'centered-dialog'],
      disableClose: false,
      autoFocus: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // If registration was successful, navigate to home
        this.router.navigate(['/home']);
      }
    });
  }
} 