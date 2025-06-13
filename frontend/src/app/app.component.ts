import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { RightSidebarComponent } from './components/right-sidebar/right-sidebar.component';
import { NotificationComponent } from './components/shared/notification/notification.component';
import { AuthService } from './services/auth.service';
import { RouterOutlet } from '@angular/router';
import { MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    SidebarComponent, 
    RightSidebarComponent, 
    NotificationComponent,
    RouterOutlet,
    MatDialogModule
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'frontend';

  constructor(
    public authService: AuthService,
  ) {}
}
