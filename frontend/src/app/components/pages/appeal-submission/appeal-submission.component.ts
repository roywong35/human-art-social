import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { AppealService, AppealStatus } from '../../../services/appeal.service';
import { ToastService } from '../../../services/toast.service';
import { PostComponent } from '../../features/posts/post/post.component';
import { Post } from '../../../models/post.model';
import { PostService } from '../../../services/post.service';

@Component({
  selector: 'app-appeal-submission',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, PostComponent],
  templateUrl: './appeal-submission.component.html',
  styleUrls: ['./appeal-submission.component.scss']
})
export class AppealSubmissionComponent implements OnInit {
  postHandle: string = '';
  postId: number = 0;
  appealText: string = '';
  selectedFiles: File[] = [];
  appealStatus: AppealStatus | null = null;
  postPreview: Post | null = null;
  loading = true;
  loadingPost = true;
  submitting = false;
  dragOver = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private appealService: AppealService,
    private toastService: ToastService,
    private postService: PostService
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.postHandle = params['handle'];
      this.postId = parseInt(params['postId']);
      this.loadAppealStatus();
      this.loadPostData();
    });
  }

  loadAppealStatus() {
    this.loading = true;
    this.appealService.getAppealStatus(this.postHandle, this.postId).subscribe({
      next: (status) => {
        this.appealStatus = status;
        this.loading = false;
        
        if (!status.can_appeal) {
          this.toastService.showError('You cannot appeal this post');
          this.router.navigate(['/']);
        }
      },
      error: (error) => {
        console.error('Error loading appeal status:', error);
        this.loading = false;
        this.toastService.showError('Failed to load appeal status');
        this.router.navigate(['/']);
      }
    });
  }

  loadPostData() {
    this.loadingPost = true;
    this.postService.getPost(this.postHandle, this.postId).subscribe({
      next: (post: Post) => {
        // Use the full Post object directly
        this.postPreview = post;
        this.loadingPost = false;
      },
      error: (error: any) => {
        console.error('Error loading post data:', error);
        this.loadingPost = false;
        // Don't navigate away - user can still submit appeal without seeing the post
      }
    });
  }

  onFileSelected(event: any) {
    const files: FileList = event.target.files;
    this.addFiles(files);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.dragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragOver = false;
    
    if (event.dataTransfer?.files) {
      this.addFiles(event.dataTransfer.files);
    }
  }

  addFiles(files: FileList) {
    const maxFiles = 5;
    const maxSize = 10 * 1024 * 1024; // 10MB per file
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (this.selectedFiles.length >= maxFiles) {
        this.toastService.showError(`Maximum ${maxFiles} files allowed`);
        break;
      }
      
      if (file.size > maxSize) {
        this.toastService.showError(`File ${file.name} is too large. Maximum size is 10MB`);
        continue;
      }
      
      this.selectedFiles.push(file);
    }
  }

  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  canSubmit(): boolean {
    return this.appealText.trim().length > 0 && !this.submitting;
  }

  onSubmit() {
    if (!this.canSubmit()) return;

    this.submitting = true;
    this.appealService.submitAppeal(this.postHandle, this.postId, this.appealText, this.selectedFiles).subscribe({
      next: (response) => {
        this.toastService.showSuccess('Appeal submitted successfully');
        this.router.navigate(['/']);
      },
      error: (error) => {
        console.error('Error submitting appeal:', error);
        this.toastService.showError('Failed to submit appeal');
        this.submitting = false;
      }
    });
  }

  onCancel() {
    this.router.navigate(['/']);
  }
} 