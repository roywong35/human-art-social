import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-change-password-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './change-password-dialog.component.html',
  styleUrls: ['./change-password-dialog.component.scss']
})
export class ChangePasswordDialogComponent {
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  error = '';
  isLoading = false;

  constructor(
    public dialogRef: MatDialogRef<ChangePasswordDialogComponent>
  ) {}

  onClose(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    this.error = '';
    
    if (this.newPassword !== this.confirmPassword) {
      this.error = 'New passwords do not match';
      return;
    }

    if (this.newPassword.length < 8) {
      this.error = 'New password must be at least 8 characters long';
      return;
    }

    this.dialogRef.close({
      currentPassword: this.currentPassword,
      newPassword: this.newPassword
    });
  }
} 