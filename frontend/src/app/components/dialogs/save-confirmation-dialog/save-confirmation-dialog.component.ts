import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-save-confirmation-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule
  ],
  templateUrl: './save-confirmation-dialog.component.html',
  styleUrls: ['./save-confirmation-dialog.component.scss']
})
export class SaveConfirmationDialogComponent {
  constructor(
    private dialogRef: MatDialogRef<SaveConfirmationDialogComponent>
  ) {}

  onSave(): void {
    this.dialogRef.close({ action: 'save' });
  }

  onDiscard(): void {
    this.dialogRef.close({ action: 'discard' });
  }

  onCancel(): void {
    this.dialogRef.close({ action: 'cancel' });
  }
} 