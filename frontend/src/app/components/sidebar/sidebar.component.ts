import { Component, OnInit, HostListener, ElementRef } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { SubmitDrawingModalComponent } from '../submit-drawing-modal/submit-drawing-modal.component';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, NavigationEnd, Event } from '@angular/router';
import { PostService } from '../../services/post.service';
import { NewPostModalComponent } from '../new-post-modal/new-post-modal.component';
import { UserService } from '../../services/user.service';
import { take, filter } from 'rxjs/operators';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit {
  showUserMenu = false;
  isHumanArtTab = false;
  isFollowingOnly = false;
  isTogglingFollowingOnly = false;
  isRefreshing = false;
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  constructor(
    public authService: AuthService,
    private dialog: MatDialog,
    private router: Router,
    private route: ActivatedRoute,
    private postService: PostService,
    private userService: UserService,
    private elementRef: ElementRef
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

  toggleUserMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.showUserMenu = !this.showUserMenu;
  }

  openContextModal(): void {
    if (this.isHumanArtTab) {
      this.dialog.open(SubmitDrawingModalComponent, {
        width: '600px',
        panelClass: ['rounded-2xl', 'create-post-dialog']
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

  @HostListener('document:click', ['$event'])
  handleClick(event: MouseEvent) {
    // Check if the click was outside the user menu and its toggle button
    const clickedInside = this.elementRef.nativeElement.contains(event.target);
    if (!clickedInside && this.showUserMenu) {
      this.showUserMenu = false;
    }
  }
} 