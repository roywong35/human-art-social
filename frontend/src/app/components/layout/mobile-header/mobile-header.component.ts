import { Component, OnInit, HostListener, ElementRef, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { filter, take } from 'rxjs/operators';
import { NewPostModalComponent } from '../../features/posts/new-post-modal/new-post-modal.component';
import { NewArtPostModalComponent } from '../../features/posts/new-art-post-modal/new-art-post-modal';
import { ChangePasswordDialogComponent } from '../../features/auth/change-password-dialog/change-password-dialog.component';
import { AuthService } from '../../../services/auth.service';
import { PostService } from '../../../services/post.service';
import { HomeRefreshService } from '../../../services/home-refresh.service';
import { SidebarService } from '../../../services/sidebar.service';
import { Subscription } from 'rxjs';
import Hammer from 'hammerjs';

@Component({
  selector: 'app-mobile-header',
  standalone: true,
  imports: [CommonModule, RouterModule, MatDialogModule],
  templateUrl: './mobile-header.component.html',
  styleUrls: ['./mobile-header.component.scss']
})
export class MobileHeaderComponent implements OnInit, OnDestroy, AfterViewInit {
  protected showSidebarDrawer = false;
  private sidebarSubscription?: Subscription;
  @ViewChild('sidebarDrawer', { static: false }) sidebarDrawer!: ElementRef;
  private subscriptions: Subscription[] = [];
  protected isHumanArtTab = false;
  protected isDarkMode = false;
  protected isHomepage = false;
  protected isFollowingOnly = false;
  protected isTogglingFollowingOnly = false;
  protected isPWAMode = false;
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';
  
  // Scroll-based hiding properties
  protected isHeaderHidden = false;
  private lastScrollTop = 0;
  private scrollThreshold = 50; // Minimum scroll distance to trigger hide/show

  constructor(
    protected authService: AuthService,
    private dialog: MatDialog,
    protected router: Router,
    private route: ActivatedRoute,
    private postService: PostService,
    private homeRefreshService: HomeRefreshService,
    private elementRef: ElementRef,
    private sidebarService: SidebarService
  ) {
    // Subscribe to route changes to detect Human Art tab and homepage
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      // Check if we're on the homepage (including with query params)
      this.isHomepage = event.url === '/' || event.url.startsWith('/home');
      
      // Check both URL and query params for human art tab
      this.route.queryParams.pipe(take(1)).subscribe(params => {
        this.isHumanArtTab = event.url.includes('human-art') || params['tab'] === 'human-drawing';
      });
    });

    // Subscribe to dark mode changes
    this.checkDarkMode();
    const observer = new MutationObserver(() => {
      this.checkDarkMode();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    // Initialize following preference from localStorage
    this.isFollowingOnly = localStorage.getItem('following_only_preference') === 'true';
  }

  private checkDarkMode(): void {
    this.isDarkMode = document.documentElement.classList.contains('dark');
  }

  ngOnInit() {
    // Initialize the homepage and human art tab state
    this.isHomepage = this.router.url === '/' || this.router.url.startsWith('/home');
    this.route.queryParams.pipe(take(1)).subscribe(params => {
      this.isHumanArtTab = this.router.url.includes('human-art') || params['tab'] === 'human-drawing';
    });

    // Detect PWA mode
    this.detectPWAMode();
    
    // Listen for PWA mode changes
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(display-mode: standalone)');
      mediaQuery.addEventListener('change', () => {
        this.detectPWAMode();
      });
    }

    // Subscribe to sidebar service
    this.sidebarSubscription = this.sidebarService.sidebarOpen$.subscribe(isOpen => {
      this.showSidebarDrawer = isOpen;
    });
  }

  ngAfterViewInit() {
    this.setupSidebarGestures();
  }

  private detectPWAMode(): void {
    this.isPWAMode = window.matchMedia('(display-mode: standalone)').matches;
  }

  @HostListener('window:scroll', ['$event'])
  onScroll(): void {
    const scrollTop = document.documentElement.scrollTop;
    const scrollDelta = scrollTop - this.lastScrollTop;
    
    // Handle header hiding/showing - synchronized with tabs
    if (Math.abs(scrollDelta) > this.scrollThreshold) {
      if (scrollDelta > 0 && scrollTop > 50) {
        // Scrolling down - hide header (same threshold as tabs)
        this.isHeaderHidden = true;
        this.updateHeaderVisibility(true);
      } else if (scrollDelta < 0) {
        // Scrolling up - show header
        this.isHeaderHidden = false;
        this.updateHeaderVisibility(false);
      }
      this.lastScrollTop = scrollTop;
    }
  }

  /**
   * Update header visibility by adding/removing hidden class
   */
  private updateHeaderVisibility(isHidden: boolean): void {
    const hostElement = this.elementRef.nativeElement;
    if (isHidden) {
      hostElement.classList.add('hidden');
    } else {
      hostElement.classList.remove('hidden');
    }
  }

  toggleSidebarDrawer(event: MouseEvent) {
    event.stopPropagation();
    this.showSidebarDrawer = !this.showSidebarDrawer;
  }

  closeSidebarDrawer() {
    this.showSidebarDrawer = false;
  }

  toggleFollowingOnly() {
    if (this.isTogglingFollowingOnly) return;
    
    this.isTogglingFollowingOnly = true;
    const newPreference = !this.isFollowingOnly;
    
    // Update local state and localStorage immediately for better UX
    this.isFollowingOnly = newPreference;
    localStorage.setItem('following_only_preference', newPreference.toString());
    
    this.authService.updateFollowingOnlyPreference(newPreference).subscribe({
      next: (user) => {
        // Get the current active tab from localStorage
        const activeTab = localStorage.getItem('activeTab') || 'for-you';
        
        // Always reload posts when toggling in either direction
        this.postService.loadPosts(true, activeTab);
        this.isTogglingFollowingOnly = false;
      },
      error: (error) => {
        // Revert on error
        console.error('Error updating preference:', error);
        this.isFollowingOnly = !newPreference;
        localStorage.setItem('following_only_preference', (!newPreference).toString());
        this.isTogglingFollowingOnly = false;
      }
    });
  }

  toggleDarkMode() {
    const htmlElement = document.documentElement;
    const isDark = htmlElement.classList.contains('dark');
    
    if (isDark) {
      htmlElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      htmlElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
    
    this.isDarkMode = !isDark;
  }

  logout() {
    this.authService.logout();
    this.closeSidebarDrawer();
  }

  openContextModal() {
    if (this.isHumanArtTab) {
      this.dialog.open(NewArtPostModalComponent, {
        panelClass: ['submit-drawing-dialog']
      });
    } else {
      this.dialog.open(NewPostModalComponent, {
        panelClass: ['create-post-dialog'],
        maxWidth: '100vw',
        maxHeight: '100vh',
        width: '100vw',
        height: '100vh',
        disableClose: false,
        hasBackdrop: true
      });
    }
  }

  openChangePasswordDialog() {
    this.dialog.open(ChangePasswordDialogComponent, {
      panelClass: ['change-password-dialog'],
      maxWidth: '100vw',
      maxHeight: '100vh',
      width: '100vw',
      height: '100vh',
      disableClose: false,
      hasBackdrop: true
    });
  }

  navigateToProfile() {
    this.authService.currentUser$.pipe(take(1)).subscribe(user => {
      if (user?.handle) {
        this.router.navigate(['/', user.handle]).then(() => {
          this.scrollToTopAfterNavigation();
        });
        this.closeSidebarDrawer();
      }
    });
  }

  navigateToConnections(tab: 'following' | 'followers') {
    this.authService.currentUser$.pipe(take(1)).subscribe(user => {
      if (user?.handle) {
        this.router.navigate(['/', user.handle, 'connections'], { 
          queryParams: { tab: tab } 
        }).then(() => {
          this.scrollToTopAfterNavigation();
        });
        this.closeSidebarDrawer();
      }
    });
  }

  navigateToHome(): void {
    console.log('🏠 Mobile Header: navigateToHome called, current URL:', this.router.url);
    
    // If already on home page, check if we need to refresh or just scroll to top
    if (this.router.url === '/home') {
      console.log('🏠 Mobile Header: Already on home page, checking if refresh needed...');
      this.scrollToTop();
      // Only refresh if there are new posts detected
      this.checkAndRefreshIfNeeded();
    } else {
      console.log('🏠 Mobile Header: Navigating to home from different page, refreshing...');
      // Navigate to home and then refresh posts (always refresh when coming from different page)
      this.router.navigate(['/home'])
        .then(() => {
          this.postService.loadPosts(true);
        });
    }
  }

  /**
   * Check if there are new posts and refresh only if needed
   */
  private checkAndRefreshIfNeeded(): void {
    console.log('🔍 Mobile Header: Checking if refresh is needed...');
    
    // Get the current latest post ID from the post service
    const currentPosts = this.postService.getCurrentPosts();
    console.log('🔍 Mobile Header: Current posts count:', currentPosts?.length);
    
    if (currentPosts && currentPosts.length > 0) {
      const latestPost = currentPosts[0];
      // Use effective publication time: scheduled_time if exists, otherwise created_at
      const currentLatestTimestamp = latestPost.scheduled_time || latestPost.created_at;
      console.log('🔍 Mobile Header: Current latest post timestamp:', currentLatestTimestamp);

      // Get the current active tab from localStorage (same as home component)
      const activeTab = localStorage.getItem('activeTab') || 'for-you';
      console.log('🔍 Mobile Header: Current active tab:', activeTab);

      // Check for new posts without refreshing the entire feed
      this.postService.checkNewPosts(currentLatestTimestamp, activeTab).subscribe({
        next: (response: any) => {
          console.log('🔍 Mobile Header: checkNewPosts response:', response);
          if (response.has_new_posts) {
            console.log('✅ Mobile Header: New posts detected! Refreshing feed...');
            // There are new posts - refresh the feed
            this.postService.loadPosts(true, activeTab);
            this.refreshHomeComponent();
          } else {
            console.log('ℹ️ Mobile Header: No new posts, staying at top without refresh');
          }
        },
        error: (error) => {
          console.error('❌ Mobile Header: Error checking for new posts:', error);
          // On error, just stay at top without refreshing
        }
      });
    } else {
      console.log('⚠️ Mobile Header: No current posts found, cannot check for new posts');
    }
  }

  /**
   * Refresh the home component to show latest posts and new posts button
   */
  private refreshHomeComponent(): void {
    // Use the service to trigger home component refresh
    // This will show the "new posts" button if there are new posts
    this.homeRefreshService.triggerHomeRefresh();
  }

  /**
   * Scroll to top of the page instantly (like X)
   */
  scrollToTop(): void {
    window.scrollTo({
      top: 0,
      behavior: 'auto'
    });
  }

  /**
   * Scroll to top after navigation completes
   */
  scrollToTopAfterNavigation(): void {
    // Use setTimeout to ensure navigation has completed
    setTimeout(() => {
      this.scrollToTop();
    }, 100);
  }

  ngOnDestroy(): void {
    if (this.sidebarSubscription) {
      this.sidebarSubscription.unsubscribe();
    }
    // Clean up all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
  }

  private setupSidebarGestures(): void {
    // Set up gestures when sidebar is shown
    const gestureSubscription = this.sidebarService.sidebarOpen$.subscribe(isOpen => {
      if (isOpen && this.sidebarDrawer) {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          this.initializeSidebarGestures();
        }, 100);
      }
    });
    this.subscriptions.push(gestureSubscription);
  }

  private initializeSidebarGestures(): void {
    if (!this.sidebarDrawer) return;

    const hammer = new Hammer(this.sidebarDrawer.nativeElement);
    
    // Configure swipe gestures for the sidebar
    hammer.get('swipe').set({ direction: Hammer.DIRECTION_HORIZONTAL });
    
    // Swipe left to close sidebar
    hammer.on('swipeleft', () => {
      this.sidebarService.closeSidebar();
    });

    // Also add gesture to the backdrop
    const backdrop = document.querySelector('.fixed.inset-0.bg-black.bg-opacity-50.z-\\[1001\\]') as HTMLElement;
    if (backdrop) {
      const backdropHammer = new Hammer(backdrop);
      backdropHammer.get('swipe').set({ direction: Hammer.DIRECTION_HORIZONTAL });
      backdropHammer.on('swipeleft', () => {
        this.sidebarService.closeSidebar();
      });
    }
  }
} 