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
import { RightSidebarComponent } from './components/layout/right-sidebar/right-sidebar.component';
import { MobileHeaderComponent } from './components/layout/mobile-header/mobile-header.component';
import { FloatingChatComponent } from './components/shared/floating-chat/floating-chat.component';

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
    FloatingChatComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'Human Art Social';
  isLoading = false;

  // Static routes that should not be treated as user handles
  private staticRoutes = ['home', 'notifications', 'bookmarks', 'search', 'recommended-users'];

  constructor(
    public authService: AuthService,
    private router: Router,
    private titleService: Title,
    private userService: UserService,
    public overlayService: OverlayService
  ) {
    this.router.events.subscribe((event: Event) => {
      if (event instanceof NavigationEnd) {
        let title = this.title;
        const currentRoute = this.router.url;

        // Set page-specific titles
        if (currentRoute === '/home') {
          title = 'Home / ' + this.title;
        } else if (currentRoute.startsWith('/search')) {
          title = 'Search / ' + this.title;
        } else if (currentRoute === '/bookmarks') {
          title = 'Bookmarks / ' + this.title;
        } else if (currentRoute === '/notifications') {
          title = 'Notifications / ' + this.title;
        } else if (currentRoute.includes('/status/')) {
          title = 'Post / ' + this.title;
        } else if (currentRoute.startsWith('/@') || (this.isUserHandleRoute(currentRoute))) {
          // Handle profile pages
          const handle = currentRoute.startsWith('/@') 
            ? currentRoute.split('/')[1].substring(1) // Remove @ symbol
            : currentRoute.substring(1); // Remove leading slash
          
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
    // Return true only if it's a single segment and not a static route
    return /^[^/]+$/.test(route) && !this.staticRoutes.includes(segment);
  }

  ngOnInit() {
    // Add any initialization logic here
  }

  isMessagesPage(): boolean {
    return this.router.url.startsWith('/messages');
  }

  isNotificationsPage(): boolean {
    return this.router.url === '/notifications';
  }
}
