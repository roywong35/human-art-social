import { Component, EventEmitter, Output } from '@angular/core';
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
              (click)="dialogRef.close()"
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
                Sign in to your account
              </h2>
            </div>

            <!-- Form -->
            <form (ngSubmit)="onSubmit()" #loginForm="ngForm">
              <div class="space-y-4">
                <!-- Email input -->
                <div>
                  <label for="email" class="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    [(ngModel)]="email"
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
                    [(ngModel)]="password"
                    id="password"
                    name="password"
                    type="password"
                    required
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Enter your password"
                  />
                </div>

                <!-- Error message -->
                <div *ngIf="loginError" class="text-red-500 text-sm text-center">
                  {{ loginError }}
                </div>

                <!-- Submit button -->
                <div>
                  <button
                    type="submit"
                    [disabled]="isLoading || !loginForm.form.valid"
                    class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span *ngIf="isLoading" class="absolute left-0 inset-y-0 flex items-center pl-3">
                      <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </span>
                    {{ isLoading ? 'Signing in...' : 'Sign in' }}
                  </button>
                </div>

                <!-- Register link -->
                <div class="text-center mt-4">
                  <button
                    type="button"
                    (click)="openRegister.emit()"
                    class="text-sm text-indigo-600 hover:text-indigo-500"
                  >
                    Don't have an account? Register
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
    public dialogRef: MatDialogRef<LoginModalComponent>
  ) {}

  onSubmit() {
    if (!this.email || !this.password) {
      this.loginError = 'Please fill in all fields';
      return;
    }

    this.isLoading = true;
    this.loginError = '';

    this.authService.login({ email: this.email, password: this.password }).subscribe({
      next: () => {
        this.notificationService.showSuccess('Successfully signed in!');
        this.dialogRef.close(true); // Close with success result
      },
      error: (error) => {
        this.isLoading = false;
        this.loginError = error.error?.detail || 'An error occurred during sign in';
      }
    });
  }
}