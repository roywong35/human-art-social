import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../../services/auth.service';
import { ToastService } from '../../../../services/toast.service';  
import { RegisterData } from '../../../../models';
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
export class RegisterModalComponent implements OnInit {
  registerData: RegisterData = {
    username: '',
    email: '',
    password: '',
    password2: '',
    handle: ''
  };
  
  registerError: string = '';
  isLoading: boolean = false;
  isPWAMode = false;
  isMobileView = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService,
    private dialogRef: MatDialogRef<RegisterModalComponent>,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.isPWAMode = true;
    
    // Check if mobile view
    this.isMobileView = window.innerWidth < 688;
    
    // Listen for window resize
    window.addEventListener('resize', () => {
      this.isMobileView = window.innerWidth < 688;
    });
  }

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

} 