import { Component, OnInit, HostListener, ElementRef, Input } from '@angular/core';
import { RouterModule, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { SubmitDrawingModalComponent } from '../submit-drawing-modal/submit-drawing-modal.component';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, NavigationEnd, Event } from '@angular/router';
import { PostService } from '../../services/post.service';
import { NewPostModalComponent } from '../new-post-modal/new-post-modal.component';
import { UserService } from '../../services/user.service';
import { take, filter } from 'rxjs/operators';
import { OverlayService } from '../../services/overlay.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit {
  @Input() isMobile = false;
  
  showUserMenu = false;
  isHumanArtTab = false;
  isFollowingOnly = false;
  isTogglingFollowingOnly = false;
  isRefreshing = false;
  isDarkMode = false;
  defaultAvatar = 'assets/placeholder-image.svg';

  constructor(
    public authService: AuthService,
    private dialog: MatDialog,
    private router: Router,
    private route: ActivatedRoute,
    private postService: PostService,
    private userService: UserService,
    private elementRef: ElementRef,
    private overlayService: OverlayService
  ) {
    // Subscribe to route changes to detect Human Art tab
    this.router.events.pipe(
      filter((event: Event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      // Check both URL and query params for human art tab
      this.route.queryParams.pipe(take(1)).subscribe(params => {
        this.isHumanArtTab = event.url.includes('human-art') || params['tab'] === 'human-drawing';
        console.log('[Sidebar] Route/Tab changed:', {
          url: event.url,
          params: params,
          isHumanArtTab: this.isHumanArtTab
        });
      });
    });
  }

  ngOnInit() {
    console.log('[Sidebar] Initializing component');
    
    // Load dark mode preference
    const darkMode = localStorage.getItem('darkMode');
    this.isDarkMode = darkMode === 'true';
    this.updateDarkMode(this.isDarkMode);
    
    // Load user's following only preference
    this.authService.currentUser$.pipe(take(1)).subscribe(user => {
      if (user) {
        console.log('[Sidebar] Got user preferences:', {
          following_only_preference: user.following_only_preference
        });
        this.isFollowingOnly = user.following_only_preference || false;
        // Store the initial preference in localStorage
        localStorage.setItem('following_only_preference', this.isFollowingOnly.toString());
      }
    });
  }

  toggleFollowingOnly(): void {
    if (this.isTogglingFollowingOnly) {
      console.log('[Sidebar] Toggle already in progress, ignoring click');
      return;
    }

    this.isTogglingFollowingOnly = true;
    const newPreference = !this.isFollowingOnly;
    
    console.log('[Sidebar] Starting toggleFollowingOnly:', {
      currentState: this.isFollowingOnly,
      newState: newPreference,
      isTogglingFollowingOnly: this.isTogglingFollowingOnly
    });
    
    // Update local state and localStorage immediately for better UX
    this.isFollowingOnly = newPreference;
    localStorage.setItem('following_only_preference', newPreference.toString());
    
    this.authService.updateFollowingOnlyPreference(newPreference).subscribe({
      next: (user) => {
        console.log('[Sidebar] Preference updated on server:', {
          newPreference,
          userPreference: user.following_only_preference
        });
        
        // Get the current active tab from localStorage
        const activeTab = localStorage.getItem('activeTab') || 'for-you';
        
        // Always reload posts when toggling in either direction
        console.log('[Sidebar] Reloading posts with new preference');
        this.postService.loadPosts(true, activeTab);
        this.isTogglingFollowingOnly = false;
      },
      error: (error) => {
        // Revert on error
        console.error('[Sidebar] Error updating preference:', error);
        this.isFollowingOnly = !newPreference;
        localStorage.setItem('following_only_preference', (!newPreference).toString());
        this.isTogglingFollowingOnly = false;
      }
    });
  }

  toggleUserMenu(event: MouseEvent) {
    event.stopPropagation();
    this.showUserMenu = !this.showUserMenu;
    if (this.showUserMenu) {
      this.overlayService.show();
    } else {
      this.overlayService.hide();
    }
  }

  closeUserMenu() {
    this.showUserMenu = false;
    this.overlayService.hide();
  }

  openContextModal(): void {
    if (this.isHumanArtTab) {
      this.dialog.open(SubmitDrawingModalComponent, {
        width: '600px',
        maxWidth: '100vw',
        panelClass: ['rounded-2xl', 'submit-drawing-dialog']
      });
    } else {
      this.dialog.open(NewPostModalComponent, {
        width: '600px',
        panelClass: ['rounded-2xl', 'create-post-dialog'],
        position: {
          top: '5%'
        }
      });
    }
  }

  async logout(): Promise<void> {
    await this.authService.logout();
  }

  isHomeActive(): boolean {
    // Return true if we're at root path or human art tab
    return this.router.url === '/' || this.router.url === '/human-art';
  }

  navigateToHome(): void {
    // If already on home page, just refresh the posts
    if (this.router.url === '/') {
      this.postService.loadPosts();
    } else {
      // Navigate to home and then refresh posts
      this.router.navigate(['/'])
        .then(() => {
          this.postService.loadPosts();
        });
    }
  }

  toggleDarkMode(): void {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('darkMode', this.isDarkMode.toString());
    this.updateDarkMode(this.isDarkMode);
  }

  private updateDarkMode(isDark: boolean): void {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  @HostListener('document:click', ['$event'])
  handleClick(event: MouseEvent) {
    // Check if the click was outside the user menu and its toggle button
    const clickedInside = this.elementRef.nativeElement.contains(event.target);
    if (!clickedInside && this.showUserMenu) {
      this.showUserMenu = false;
    }
  }
} 