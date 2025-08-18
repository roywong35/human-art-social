import { Component, EventEmitter, Output, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../../services/auth.service';
import { ToastService } from '../../../../services/toast.service';
import { MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { RegisterModalComponent } from '../register-modal/register-modal.component';

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
  emailError: string = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService,
    private renderer: Renderer2,
    public dialogRef: MatDialogRef<LoginModalComponent>,
    private dialog: MatDialog
  ) {}

  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  onEmailChange(): void {
    this.emailError = '';
    this.loginError = '';
    
    if (this.email && !this.validateEmail(this.email)) {
      this.emailError = 'Please enter a valid email address';
    }
  }

  onPasswordChange(): void {
    this.loginError = '';
  }

  clearErrors(): void {
    this.loginError = '';
    this.emailError = '';
  }

  onSubmit() {
    // Clear previous errors
    this.loginError = '';
    this.emailError = '';

    // Validate email format
    if (this.email && !this.validateEmail(this.email)) {
      this.emailError = 'Please enter a valid email address';
      return;
    }

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
        this.toastService.showSuccess('Successfully signed in!');
        this.dialogRef.close(true); // Close with success result
        this.router.navigate(['/home']);
      },
      error: (error) => {
        // If login fails, show the landing component again
        if (landingElement) {
          this.renderer.removeStyle(landingElement, 'display');
        }
        this.isLoading = false;
        
        // Handle different types of authentication errors
        if (error.status === 401 && error.error) {
          // Backend provides specific error messages for authentication failures
          this.loginError = error.error.detail || 'Invalid email or password. Please try again.';
        } else if (error.status === 400 && error.error) {
          // Other validation errors
          this.loginError = error.error.detail || 'Invalid credentials. Please try again.';
        } else if (error.status === 0) {
          // Network error
          this.loginError = 'Unable to connect to the server. Please check your internet connection.';
        } else {
          // Generic error
          this.loginError = 'An error occurred during sign in. Please try again.';
        }
        
      }
    });
  }

  openRegisterModal() {
    // Close the login modal
    this.dialogRef.close();
    
    // Open the register modal
    this.dialog.open(RegisterModalComponent, {
      width: '450px',
      panelClass: 'custom-dialog-container'
    });
  }
}