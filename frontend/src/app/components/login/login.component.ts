import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LoginCredentials, RegisterData } from '../../models';
import { NotificationService } from '../../services/notification.service';
import { RegisterComponent } from '../register/register.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RegisterComponent],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  // Login form
  email: string = '';
  password: string = '';
  
  // Register form
  showRegisterModal: boolean = false;
  registerData: RegisterData = {
    username: '',
    email: '',
    password: '',
    password2: '',
    handle: ''
  };
  
  // Error and loading states
  loginError: string = '';
  registerError: string = '';
  isLoading: boolean = false;
  isRegistering: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    // Check if user is already logged in
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.router.navigate(['/home']);
      }
    });
  }

  onSubmit() {
    if (!this.email || !this.password) {
      this.loginError = 'Please enter both email and password';
      return;
    }

    this.loginError = '';
    this.isLoading = true;

    const credentials: LoginCredentials = {
      email: this.email,
      password: this.password
    };

    this.authService.login(credentials).subscribe({
      next: (user) => {
        this.isLoading = false;
        this.notificationService.showSuccess('Welcome back!');
        setTimeout(() => {
          this.router.navigate(['/home']);
        }, 100);
      },
      error: (error) => {
        this.isLoading = false;
        
        if (error.status === 401) {
          this.loginError = 'Invalid email or password';
        } else if (error.status === 400) {
          if (error.error && typeof error.error === 'object') {
            const errors = Object.entries(error.error)
              .map(([field, messages]) => `${field}: ${messages}`)
              .join(', ');
            this.loginError = errors;
          } else {
            this.loginError = error.error?.detail || 'Invalid login data. Please check your input.';
          }
        } else if (error.status === 0) {
          this.loginError = 'Unable to connect to the server. Please check your internet connection.';
        } else if (error.message === 'No access token in response') {
          this.loginError = 'Server error: Invalid response format';
        } else if (error.message === 'No access token available') {
          this.loginError = 'Authentication error: No token received';
        } else {
          this.loginError = 'An unexpected error occurred. Please try again later.';
        }
      }
    });
  }

  openRegisterModal() {
    this.showRegisterModal = true;
    this.registerError = '';
    this.registerData = {
      username: '',
      email: '',
      password: '',
      password2: '',
      handle: ''
    };
  }

  closeRegisterModal() {
    this.showRegisterModal = false;
    this.registerError = '';
  }

  onRegistrationComplete() {
    this.closeRegisterModal();
    this.notificationService.showSuccess('Registration successful! Welcome to Human Art Social.');
    this.router.navigate(['/home']);
  }

  onRegisterSubmit() {
    // Validate all required fields
    if (!this.registerData.username || !this.registerData.email || 
        !this.registerData.password || !this.registerData.password2) {
      this.registerError = 'Please fill in all required fields';
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
        this.showRegisterModal = false;
        this.notificationService.showSuccess('Registration successful! Welcome to Human Art Social.');
        this.router.navigate(['/home']);
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