import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { PostService } from '../../../../services/post.service';
import { ToastService } from '../../../../services/toast.service';
import { Post } from '../../../../models/post.model';

export interface ReportModalData {
  post: Post;
}

export interface ReportType {
  value: string;
  label: string;
}

@Component({
  selector: 'app-report-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule
  ],
  templateUrl: './report-modal.component.html',
  styleUrls: ['./report-modal.component.scss']
})
export class ReportModalComponent implements OnInit {
  post: Post;
  reportTypes: ReportType[] = [];
  selectedReportType: string = '';
  description: string = '';
  isSubmitting: boolean = false;
  loadingReportTypes: boolean = true;

  constructor(
    public dialogRef: MatDialogRef<ReportModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ReportModalData,
    private postService: PostService,
    private toastService: ToastService
  ) {
    this.post = data.post;
  }

  ngOnInit(): void {
    this.loadReportTypes();
  }

  private loadReportTypes(): void {
    this.loadingReportTypes = true;
    this.postService.getReportTypes(this.post.author.handle, this.post.id).subscribe({
      next: (response) => {
        // Handle both array format [['code', 'label'], ...] and object format [{value: 'code', label: 'label'}, ...]
        if (response.report_types && Array.isArray(response.report_types)) {
          if (response.report_types.length > 0 && Array.isArray(response.report_types[0])) {
            // Convert array format to object format
            this.reportTypes = response.report_types.map((item: [string, string]) => ({
              value: item[0],
              label: item[1]
            }));
          } else {
            // Already in object format
            this.reportTypes = response.report_types;
          }
        } else {
          this.reportTypes = [];
        }
        
        this.loadingReportTypes = false;
      },
      error: (error) => {
        console.error('Error loading report types:', error);
        this.toastService.showError('Failed to load report options');
        this.loadingReportTypes = false;
        this.onCancel();
      }
    });
  }

  onSubmit(): void {
    if (!this.selectedReportType) {
      this.toastService.showError('Please select a report reason');
      return;
    }

    if (this.isSubmitting) return;

    this.isSubmitting = true;

    const reportData = {
      report_type: this.selectedReportType,
      description: this.description.trim()
    };

    this.postService.reportPost(this.post.author.handle, this.post.id, reportData).subscribe({
      next: (response) => {
        this.toastService.showSuccess('Report submitted successfully');
        this.dialogRef.close({ success: true, reportData });
      },
      error: (error) => {
        console.error('Error submitting report:', error);
        const errorMessage = error.error?.error || 'Failed to submit report';
        this.toastService.showError(errorMessage);
        this.isSubmitting = false;
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close({ success: false });
  }

  get canSubmit(): boolean {
    return !!this.selectedReportType && !this.isSubmitting;
  }

  get isAiArtReport(): boolean {
    return this.selectedReportType === 'ai_art';
  }
} 