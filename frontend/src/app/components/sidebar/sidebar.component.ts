import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { SubmitDrawingModalComponent } from '../submit-drawing-modal/submit-drawing-modal.component';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { PostService } from '../../services/post.service';
import { NewPostModalComponent } from '../new-post-modal/new-post-modal.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, SubmitDrawingModalComponent],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
  showUserMenu = false;
  isHumanArtTab = false;
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  constructor(
    public authService: AuthService,
    private dialog: MatDialog,
    private route: ActivatedRoute,
    private router: Router,
    private postService: PostService
  ) {
    // Subscribe to route query params to detect active tab
    this.route.queryParams.subscribe(params => {
      this.isHumanArtTab = params['tab'] === 'human-drawing';
    });
  }

  openContextModal(): void {
    console.log('Sidebar: openContextModal called');
    console.log('Sidebar: isHumanArtTab =', this.isHumanArtTab);
    
    if (this.isHumanArtTab) {
      console.log('Sidebar: Opening SubmitDrawingModal');
      this.dialog.open(SubmitDrawingModalComponent, {
        width: '600px',
        maxHeight: '90vh',
        panelClass: 'submit-drawing-dialog',
        position: { top: '5%' }
      }).afterClosed().subscribe(result => {
        if (result) {
          this.postService.loadPosts();
        }
      });
    } else {
      console.log('Sidebar: Opening NewPostModal');
      const dialogRef = this.dialog.open(NewPostModalComponent, {
        width: '600px',
        maxHeight: '90vh',
        position: { top: '5%' },
        panelClass: 'rounded-dialog',
        autoFocus: false,
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop'
      });
      
      console.log('Sidebar: Dialog reference:', dialogRef);
      
      dialogRef.afterClosed().subscribe(result => {
        console.log('Sidebar: Modal closed with result:', result);
        if (result) {
          this.postService.loadPosts();
        }
      });
    }
  }

  toggleUserMenu(event: Event): void {
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
} 