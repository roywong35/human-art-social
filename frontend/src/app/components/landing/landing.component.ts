import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PostComponent } from '../shared/post/post.component';
import { SearchBarComponent } from '../search-bar/search-bar.component';
import { PostService } from '../../services/post.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Post } from '../../models/post.model';
import { LoginModalComponent } from '../login-modal/login-modal.component';
import { RegisterModalComponent } from '../register-modal/register-modal.component';
import { AuthService } from '../../services/auth.service';
import { MatDialog } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PostComponent,
    SearchBarComponent,
    LoginModalComponent,
    RegisterModalComponent,
    MatDialogModule
  ],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent implements OnInit {
  posts: Post[] = [];
  activeTab: 'for-you' | 'human-drawing' = 'for-you';
  isDarkMode = false;

  constructor(
    private postService: PostService,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private dialog: MatDialog
  ) {}

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

      // Reload posts for the new tab
      this.loadPosts();
    }
  }

  private loadPosts() {
    this.postService.getPublicPosts(this.activeTab).subscribe(
      response => {
        // Handle paginated response
        const posts = response.results || [];
        this.posts = posts;
      }
    );
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
      width: '400px',
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