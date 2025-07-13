import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { filter, take } from 'rxjs/operators';
import { NewPostModalComponent } from '../../features/posts/new-post-modal/new-post-modal.component';
import { NewArtPostModalComponent } from '../../features/posts/new-art-post-modal/new-art-post-modal';
import { AuthService } from '../../../services/auth.service';
import { PostService } from '../../../services/post.service';

@Component({
  selector: 'app-mobile-header',
  standalone: true,
  imports: [CommonModule, RouterModule, MatDialogModule],
  templateUrl: './mobile-header.component.html',
  styleUrls: ['./mobile-header.component.scss']
})
export class MobileHeaderComponent implements OnInit {
  protected showSidebarDrawer = false;
  protected isHumanArtTab = false;
  protected isDarkMode = false;
  protected isHomepage = false;
  protected isFollowingOnly = false;
  protected isTogglingFollowingOnly = false;
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  constructor(
    protected authService: AuthService,
    private dialog: MatDialog,
    private router: Router,
    private route: ActivatedRoute,
    private postService: PostService
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

  navigateToProfile() {
    this.authService.currentUser$.pipe(take(1)).subscribe(user => {
      if (user?.handle) {
        this.router.navigate(['/', user.handle]);
        this.closeSidebarDrawer();
      }
    });
  }

  navigateToConnections(tab: 'following' | 'followers') {
    this.authService.currentUser$.pipe(take(1)).subscribe(user => {
      if (user?.handle) {
        this.router.navigate(['/', user.handle, 'connections'], { 
          queryParams: { tab: tab } 
        });
        this.closeSidebarDrawer();
      }
    });
  }
} 