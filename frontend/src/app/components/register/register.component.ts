import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { RegisterData } from '../../models';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  @Output() registrationComplete = new EventEmitter<void>();

  registerData: RegisterData = {
    username: '',
    email: '',
    password: '',
    password2: '',
    handle: ''
  };

  registerError: string = '';
  isRegistering: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private notificationService: NotificationService
  ) {}

  onSubmit() {
    // Validate all required fields
    if (!this.registerData.username || !this.registerData.email || 
        !this.registerData.password || !this.registerData.password2 || 
        !this.registerData.handle) {
      this.registerError = 'Please fill in all required fields';
      return;
    }

    // Validate handle format
    const handleRegex = /^[a-zA-Z0-9_]+$/;
    if (!handleRegex.test(this.registerData.handle)) {
      this.registerError = 'Handle can only contain letters, numbers, and underscores';
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.registerData.email)) {
      this.registerError = 'Please enter a valid email address';
      return;
    }

    // Validate password match
    if (this.registerData.password !== this.registerData.password2) {
      this.registerError = 'Passwords do not match';
      return;
    }

    // Validate password strength - changed to 6 characters to match auth service
    if (this.registerData.password.length < 6) {
      this.registerError = 'Password must be at least 6 characters long';
      return;
    }

    this.registerError = '';
    this.isRegistering = true;

    this.authService.register(this.registerData).subscribe({
      next: (user) => {
        this.isRegistering = false;
        this.registrationComplete.emit();
      },
      error: (error) => {
        this.isRegistering = false;
        console.error('Registration error:', error);

        if (error.status === 400) {
          if (error.error && typeof error.error === 'object') {
            const errors = Object.entries(error.error)
              .map(([field, messages]) => `${field}: ${messages}`)
              .join(', ');
            this.registerError = errors;
          } else {
            this.registerError = 'Invalid registration data. Please check your input.';
          }
        } else if (error.status === 409) {
          this.registerError = 'Username or email already exists';
        } else if (error.status === 0) {
          this.registerError = 'Unable to connect to the server. Please check your internet connection.';
        } else {
          this.registerError = 'An unexpected error occurred. Please try again later.';
        }
      }
    });
  }
} 