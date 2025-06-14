import { Component, OnInit } from '@angular/core';
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
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  constructor(
    public authService: AuthService,
    private dialog: MatDialog,
    private router: Router,
    private route: ActivatedRoute,
    private postService: PostService
  ) {
    // Subscribe to route query params to detect tab changes
    this.router.events.pipe(
      filter((event: Event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe(() => {
      // Get current query params
      this.route.queryParams.pipe(take(1)).subscribe(params => {
        this.isHumanArtTab = params['tab'] === 'human-drawing';
      });
    });
  }

  ngOnInit() {
    // Load user's following only preference
    this.authService.currentUser$.pipe(take(1)).subscribe(user => {
      if (user) {
        this.isFollowingOnly = user.following_only_preference || false;
      }
    });
  }

  toggleFollowingOnly(): void {
    if (this.isTogglingFollowingOnly) return;

    this.isTogglingFollowingOnly = true;
    const newPreference = !this.isFollowingOnly;
    
    this.authService.updateFollowingOnlyPreference(newPreference).subscribe({
      next: (user) => {
        this.isFollowingOnly = user.following_only_preference || false;
        this.isTogglingFollowingOnly = false;
        // Reload posts with new preference
        this.postService.loadPosts();
      },
      error: (error) => {
        console.error('Error updating following only preference:', error);
        this.isTogglingFollowingOnly = false;
      }
    });
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

  toggleUserMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.showUserMenu = !this.showUserMenu;
    
    if (this.showUserMenu) {
      setTimeout(() => {
        document.addEventListener('click', this.closeUserMenu);
      });
    }
  }

  private closeUserMenu = () => {
    this.showUserMenu = false;
    document.removeEventListener('click', this.closeUserMenu);
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
} 