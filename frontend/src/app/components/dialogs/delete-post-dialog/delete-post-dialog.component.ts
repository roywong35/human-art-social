import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-delete-post-dialog',
  templateUrl: './delete-post-dialog.component.html',
  styleUrls: ['./delete-post-dialog.component.scss'],
  standalone: true,
  imports: [CommonModule, MatDialogModule]
})
export class DeletePostDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<DeletePostDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { postId: number, content: string }
  ) {}

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
