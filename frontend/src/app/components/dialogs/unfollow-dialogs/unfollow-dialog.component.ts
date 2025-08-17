import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-unfollow-dialog',
  templateUrl: './unfollow-dialog.component.html',
  styleUrls: ['./unfollow-dialog.component.scss'],
  standalone: true,
  imports: [CommonModule, MatDialogModule]
})
export class UnfollowDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<UnfollowDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { handle: string }
  ) {}

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
} 