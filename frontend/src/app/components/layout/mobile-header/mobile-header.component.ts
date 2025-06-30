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

@Component({
  selector: 'app-mobile-header',
  standalone: true,
  imports: [CommonModule, RouterModule, MatDialogModule],
  templateUrl: './mobile-header.component.html',
  styleUrls: ['./mobile-header.component.scss']
})
export class MobileHeaderComponent implements OnInit {
  protected showUserMenu = false;
  protected isHumanArtTab = false;
  protected isDarkMode = false;
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  constructor(
    protected authService: AuthService,
    private dialog: MatDialog,
    private router: Router,
    private route: ActivatedRoute
  ) {
    // Subscribe to route changes to detect Human Art tab
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
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
  }

  private checkDarkMode(): void {
    this.isDarkMode = document.documentElement.classList.contains('dark');
  }

  ngOnInit() {
    // Initialize the human art tab state
    this.route.queryParams.pipe(take(1)).subscribe(params => {
      this.isHumanArtTab = this.router.url.includes('human-art') || params['tab'] === 'human-drawing';
    });
  }

  toggleUserMenu(event: MouseEvent) {
    event.stopPropagation();
    this.showUserMenu = !this.showUserMenu;
  }

  closeUserMenu() {
    this.showUserMenu = false;
  }

  logout() {
    this.authService.logout();
    this.closeUserMenu();
  }

  openContextModal() {
    if (this.isHumanArtTab) {
      this.dialog.open(NewArtPostModalComponent, {
        panelClass: ['submit-drawing-dialog']
      });
    } else {
      this.dialog.open(NewPostModalComponent, {
        panelClass: ['create-post-dialog']
      });
    }
  }
} 