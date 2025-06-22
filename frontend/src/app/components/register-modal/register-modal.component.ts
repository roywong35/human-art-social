import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { RegisterData } from '../../models';

@Component({
  selector: 'app-register-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <!-- Background overlay -->
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" (click)="close.emit()"></div>

        <!-- Modal panel -->
        <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
          <!-- Close button -->
          <div class="absolute top-0 right-0 pt-4 pr-4">
            <button
              type="button"
              (click)="close.emit()"
              class="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <span class="sr-only">Close</span>
              <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="p-6">
            <!-- Header -->
            <div class="text-center">
              <h2 class="text-2xl font-bold text-gray-900 mb-6">
                Create your account
              </h2>
            </div>

            <!-- Form -->
            <form (ngSubmit)="onSubmit()" #registerForm="ngForm">
              <div class="space-y-4">
                <!-- Name input -->
                <div>
                  <label for="username" class="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    [(ngModel)]="registerData.username"
                    id="username"
                    name="username"
                    type="text"
                    required
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Enter your name (you can customize this anytime)"
                  />
                </div>

                <!-- Handle input -->
                <div>
                  <label for="handle" class="block text-sm font-medium text-gray-700">Handle</label>
                  <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">&#64;</span>
                    <input
                      [(ngModel)]="registerData.handle"
                      id="handle"
                      name="handle"
                      type="text"
                      required
                      class="mt-1 block w-full px-3 py-2 pl-8 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="Choose your handle (this will be permanent)"
                    />
                  </div>
                </div>

                <!-- Email input -->
                <div>
                  <label for="email" class="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    [(ngModel)]="registerData.email"
                    id="email"
                    name="email"
                    type="email"
                    required
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Enter your email"
                  />
                </div>

                <!-- Password input -->
                <div>
                  <label for="password" class="block text-sm font-medium text-gray-700">Password</label>
                  <input
                    [(ngModel)]="registerData.password"
                    id="password"
                    name="password"
                    type="password"
                    required
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Create a password"
                  />
                </div>

                <!-- Confirm Password input -->
                <div>
                  <label for="password2" class="block text-sm font-medium text-gray-700">Confirm Password</label>
                  <input
                    [(ngModel)]="registerData.password2"
                    id="password2"
                    name="password2"
                    type="password"
                    required
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Confirm your password"
                  />
                </div>

                <!-- Error message -->
                <div *ngIf="registerError" class="text-red-500 text-sm text-center">
                  {{ registerError }}
                </div>

                <!-- Submit button -->
                <div>
                  <button
                    type="submit"
                    [disabled]="isLoading || !registerForm.form.valid"
                    class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span *ngIf="isLoading" class="absolute left-0 inset-y-0 flex items-center pl-3">
                      <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </span>
                    {{ isLoading ? 'Creating account...' : 'Create account' }}
                  </button>
                </div>

                <!-- Login link -->
                <div class="text-center mt-4">
                  <button
                    type="button"
                    (click)="openLogin.emit()"
                    class="text-sm text-indigo-600 hover:text-indigo-500"
                  >
                    Already have an account? Sign in
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  `
})
export class RegisterModalComponent {
  @Output() close = new EventEmitter<void>();
  @Output() openLogin = new EventEmitter<void>();

  registerData: RegisterData = {
    username: '',
    email: '',
    password: '',
    password2: '',
    handle: ''
  };
  
  registerError: string = '';
  isLoading: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private notificationService: NotificationService
  ) {}

  onSubmit() {
    // Validate all required fields
    if (!this.registerData.username || !this.registerData.email || 
        !this.registerData.password || !this.registerData.password2 || !this.registerData.handle) {
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

    // Validate password strength
    if (this.registerData.password.length < 6) {
      this.registerError = 'Password must be at least 6 characters long';
      return;
    }

    this.registerError = '';
    this.isLoading = true;

    this.authService.register(this.registerData).subscribe({
      next: () => {
        this.notificationService.showSuccess('Account created successfully! Please sign in.');
        this.openLogin.emit();
      },
      error: (error) => {
        this.isLoading = false;
        this.registerError = error.error?.detail || 'An error occurred during registration';
      }
    });
  }
} 