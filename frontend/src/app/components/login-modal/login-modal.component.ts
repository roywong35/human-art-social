import { Component, EventEmitter, Output, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { MatDialogRef } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-login-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './login-modal.component.html',
  styleUrls: ['./login-modal.component.scss']
})
export class LoginModalComponent {
  @Output() close = new EventEmitter<void>();
  @Output() openRegister = new EventEmitter<void>();

  email: string = '';
  password: string = '';
  loginError: string = '';
  isLoading: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private notificationService: NotificationService,
    private renderer: Renderer2,
    public dialogRef: MatDialogRef<LoginModalComponent>
  ) {}

  onSubmit() {
    if (!this.email || !this.password) {
      this.loginError = 'Please fill in all fields';
      return;
    }

    this.isLoading = true;
    this.loginError = '';

    // Hide the landing component immediately
    const landingElement = document.querySelector('app-landing');
    if (landingElement) {
      this.renderer.setStyle(landingElement, 'display', 'none');
    }

    this.authService.login({ email: this.email, password: this.password }).subscribe({
      next: () => {
        this.notificationService.showSuccess('Successfully signed in!');
        this.dialogRef.close(true); // Close with success result
        this.router.navigate(['/home']);
      },
      error: (error) => {
        // If login fails, show the landing component again
        if (landingElement) {
          this.renderer.removeStyle(landingElement, 'display');
        }
        this.isLoading = false;
        this.loginError = error.error?.detail || 'An error occurred during sign in';
      }
    });
  }
}