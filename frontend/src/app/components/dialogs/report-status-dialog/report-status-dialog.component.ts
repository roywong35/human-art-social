import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-report-status-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  templateUrl: './report-status-dialog.component.html',
  styleUrls: ['./report-status-dialog.component.scss']
})
export class ReportStatusDialogComponent implements OnInit {
  constructor(
    private dialogRef: MatDialogRef<ReportStatusDialogComponent>
  ) {}

  ngOnInit() {
    console.log('🔔 ReportStatusDialogComponent initialized');
  }

  close() {
    console.log('🔔 ReportStatusDialogComponent closing');
    this.dialogRef.close();
  }
} 