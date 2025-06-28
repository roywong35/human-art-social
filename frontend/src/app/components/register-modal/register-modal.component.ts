import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { RegisterData } from '../../models';
import { MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { LoginModalComponent } from '../login-modal/login-modal.component';

@Component({
  selector: 'app-register-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './register-modal.component.html',
  styleUrls: ['./register-modal.component.scss']
})
export class RegisterModalComponent {
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
    private toastService: ToastService,
    private dialogRef: MatDialogRef<RegisterModalComponent>,
    private dialog: MatDialog
  ) {}

  onClose() {
    this.dialogRef.close();
  }

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

    // Validate handle format (only letters, numbers, and underscores)
    const handleRegex = /^[a-zA-Z0-9_]+$/;
    if (!handleRegex.test(this.registerData.handle)) {
      this.registerError = 'Handle can only contain letters, numbers, and underscores';
      return;
    }

    this.isLoading = true;
    this.registerError = '';

    this.authService.register(this.registerData).subscribe({
      next: () => {
        this.toastService.showSuccess('Account created successfully!');
        this.dialogRef.close(true); // Close with success result
      },
      error: (error) => {
        this.isLoading = false;
        if (error.error?.handle) {
          this.registerError = 'This handle is already taken';
        } else if (error.error?.email) {
          this.registerError = 'This email is already registered';
        } else {
          this.registerError = error.error?.detail || 'An error occurred during registration';
        }
      }
    });
  }

  switchToLogin() {
    // Close the register modal
    this.dialogRef.close();

    // Open the login modal
    this.dialog.open(LoginModalComponent, {
      width: '400px',
      panelClass: 'custom-dialog-container'
    });
  }

  generateRandomString(length: number, allowedChars: string = 'abcdefghijklmnopqrstuvwxyz0123456789'): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += allowedChars.charAt(Math.floor(Math.random() * allowedChars.length));
    }
    return result;
  }

  fillDemoAccount() {
    const timestamp = Date.now().toString(36); // Use timestamp to ensure uniqueness
    const randomId = this.generateRandomString(4);
    const uniqueId = `${timestamp}${randomId}`;
    
    this.registerData = {
      username: `Demo${uniqueId}`,
      email: `demo.${uniqueId}@example.com`,
      password: `Demo${uniqueId}!2024`, // Ensure strong password with special chars and numbers
      password2: `Demo${uniqueId}!2024`,
      handle: `demo_${uniqueId}`
    };
  }
} 