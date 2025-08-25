import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AppealService, AppealStatus } from '../../../services/appeal.service';
import { Router } from '@angular/router';
import { PostComponent } from '../../features/posts/post/post.component';
import { Post } from '../../../models/post.model';

@Component({
  selector: 'app-post-removal-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, PostComponent],
  templateUrl: './post-removal-dialog.component.html',
  styleUrls: ['./post-removal-dialog.component.scss']
})
export class PostRemovalDialogComponent implements OnInit {
  appealStatus: AppealStatus | null = null;
  loading = true;
  postPreview: Post | null = null;
  isPWAMode = false;
  isMobileView = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { postId: number; postHandle: string; post?: Post },
    private dialogRef: MatDialogRef<PostRemovalDialogComponent>,
    private appealService: AppealService,
    private router: Router
  ) {
    // Set post preview from dialog data if available
    this.postPreview = data.post || null;
  }

  ngOnInit() {
    // Check if running as PWA
    this.isPWAMode = window.matchMedia('(display-mode: standalone)').matches;
    
    // Listen for PWA mode changes
    window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
      this.isPWAMode = e.matches;
    });
    
    // Check if mobile view
    this.isMobileView = window.innerWidth < 688;
    
    // Listen for window resize
    window.addEventListener('resize', () => {
      this.isMobileView = window.innerWidth < 688;
    });
    
    this.loadAppealStatus();
  }



  loadAppealStatus() {
    this.loading = true;
    this.appealService.getAppealStatus(this.data.postHandle, this.data.postId).subscribe({
      next: (status) => {
        this.appealStatus = status;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading appeal status:', error);
        this.loading = false;
      }
    });
  }

  onAppealClick() {
    this.dialogRef.close();
    this.router.navigate(['/appeal', this.data.postHandle, this.data.postId]);
  }



  onClose() {
    this.dialogRef.close();
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'pending':
        return 'text-yellow-600';
      case 'approved':
        return 'text-green-600';
      case 'rejected':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'pending':
        return 'Under Review';
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      default:
        return status;
    }
  }
} 