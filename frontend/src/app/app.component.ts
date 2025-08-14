import { Component, OnInit } from '@angular/core';
import { RouterModule, Router, Event, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './components/layout/sidebar/sidebar.component';
import { ToastComponent } from './components/shared/toast/toast.component';
import { AuthService } from './services/auth.service';
import { RouterOutlet } from '@angular/router';
import { MatDialogModule } from '@angular/material/dialog';
import { EmojiPickerComponent } from './components/shared/emoji-picker/emoji-picker.component';
import { Title } from '@angular/platform-browser';
import { UserService } from './services/user.service';
import { User } from './models/user.model';
import { OverlayService } from './services/overlay.service';
import { ScheduledPostService } from './services/scheduled-post.service';
import { RightSidebarComponent } from './components/layout/right-sidebar/right-sidebar.component';
import { MobileHeaderComponent } from './components/layout/mobile-header/mobile-header.component';
import { FloatingChatComponent } from './components/shared/floating-chat/floating-chat.component';
import { UserPreviewModalComponent } from './components/shared/user-preview-modal/user-preview-modal.component';
import { GlobalModalService } from './services/global-modal.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    SidebarComponent, 
    RightSidebarComponent, 
    ToastComponent,
    RouterOutlet,
    MatDialogModule,
    EmojiPickerComponent,
    MobileHeaderComponent,
    FloatingChatComponent,
    UserPreviewModalComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'Human Art Social';
  isLoading = false;
  isInitialLoad = true; // New property to handle initial FOUC

  // Static routes that should not be treated as user handles
  private staticRoutes = ['home', 'notifications', 'bookmarks', 'search', 'recommended-users', 'appeals', 'appeal', 'messages', 'landing'];

  constructor(
    public authService: AuthService,
    private router: Router,
    private titleService: Title,
    private userService: UserService,
    public overlayService: OverlayService,
    private scheduledPostService: ScheduledPostService,
    public globalModalService: GlobalModalService
  ) {
    this.router.events.subscribe((event: Event) => {
      if (event instanceof NavigationEnd) {
        let title = this.title;
        const currentRoute = this.router.url;

        // Set page-specific titles
        if (currentRoute === '/') {
          title = this.title; // Landing page uses default title
        } else if (currentRoute === '/home') {
          title = 'Home / ' + this.title;
        } else if (currentRoute.startsWith('/search')) {
          title = 'Search / ' + this.title;
        } else if (currentRoute === '/bookmarks') {
          title = 'Bookmarks / ' + this.title;

        } else if (currentRoute === '/notifications') {
          title = 'Notifications / ' + this.title;
        } else if (currentRoute.startsWith('/messages')) {
          title = 'Messages / ' + this.title;
        } else if (currentRoute === '/appeals') {
          title = 'Appeals / ' + this.title;
        } else if (currentRoute.startsWith('/appeal/')) {
          title = 'Appeal / ' + this.title;
        } else if (currentRoute === '/recommended-users') {
          title = 'Recommended Users / ' + this.title;
        } else if (currentRoute.includes('/post/')) {
          title = 'Post / ' + this.title;
        } else if (currentRoute.includes('/followers')) {
          title = 'Followers / ' + this.title;
        } else if (currentRoute.includes('/following')) {
          title = 'Following / ' + this.title;
        } else if (currentRoute.includes('/connections')) {
          title = 'Connections / ' + this.title;
        } else if (this.isUserHandleRoute(currentRoute)) {
          // Handle profile pages
          const segments = currentRoute.substring(1).split('/');
          const handle = segments[0];
          
          // Get user info to set the display name in title
          this.userService.getUserByHandle(handle).subscribe({
            next: (user: User) => {
              this.titleService.setTitle(`${user.username} / ${this.title}`);
              this.isLoading = false;
            },
            error: () => {
              this.titleService.setTitle(this.title);
              this.isLoading = false;
            }
          });
          return; // Skip the default title setting below
        }

        this.titleService.setTitle(title);
      }

      switch (true) {
        case event instanceof NavigationStart: {
          this.isLoading = true;
          break;
        }
        case event instanceof NavigationEnd:
        case event instanceof NavigationCancel:
        case event instanceof NavigationError: {
          this.isLoading = false;
          break;
        }
        default: {
          break;
        }
      }
    });
  }

  private isUserHandleRoute(route: string): boolean {
    // Remove leading slash and get the first segment
    const segment = route.substring(1).split('/')[0];
    
    // Check if it's a static route
    if (this.staticRoutes.includes(segment)) {
      return false;
    }
    
    // Check if it's a valid user handle route (single segment, not empty)
    // User handles should be alphanumeric with possible underscores/hyphens
    const isValidHandle = /^[a-zA-Z0-9_-]+$/.test(segment);
    
    return isValidHandle && segment.length > 0;
  }

  ngOnInit() {
    // Initialize scheduled post service (constructor starts the background checking)
    // The service is injected and started automatically, no additional action needed
    console.log('App initialized with scheduled post service');
    
    // Hide initial loading after Angular has fully initialized
    // This prevents FOUC (Flash of Unstyled Content)
    setTimeout(() => {
      this.isInitialLoad = false;
    }, 100); // Small delay to ensure all styles are loaded
  }

  isMessagesPage(): boolean {
    return this.router.url.startsWith('/messages');
  }

  isNotificationsPage(): boolean {
    return this.router.url === '/notifications';
  }
}
