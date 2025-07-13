import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AppealService, PostAppeal } from '../../../services/appeal.service';
import { TimeAgoPipe } from '../../../pipes/time-ago.pipe';

@Component({
  selector: 'app-appeals',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, TimeAgoPipe],
  templateUrl: './appeals.component.html',
  styleUrls: ['./appeals.component.scss']
})
export class AppealsComponent implements OnInit {
  appeals: PostAppeal[] = [];
  loading = true;
  loadingMore = false;
  currentPage = 1;
  hasMore = false;
  totalCount = 0;

  constructor(private appealService: AppealService) {}

  ngOnInit() {
    this.loadAppeals();
  }

  loadAppeals() {
    this.loading = true;
    this.appealService.getMyAppeals(this.currentPage).subscribe({
      next: (response) => {
        if (this.currentPage === 1) {
          this.appeals = response.results;
        } else {
          this.appeals = [...this.appeals, ...response.results];
        }
        this.totalCount = response.count;
        this.hasMore = response.results.length === 10; // Assuming page size is 10
        this.loading = false;
        this.loadingMore = false;
      },
      error: (error) => {
        console.error('Error loading appeals:', error);
        this.loading = false;
        this.loadingMore = false;
      }
    });
  }

  loadMore() {
    if (this.loadingMore || !this.hasMore) return;
    
    this.loadingMore = true;
    this.currentPage++;
    this.loadAppeals();
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
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

  getStatusIcon(status: string): string {
    switch (status) {
      case 'pending':
        return 'schedule';
      case 'approved':
        return 'check_circle';
      case 'rejected':
        return 'cancel';
      default:
        return 'help';
    }
  }

  downloadFile(fileUrl: string, filename: string) {
    // Create a temporary link element to trigger download
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  isImageFile(filename: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  }
} 