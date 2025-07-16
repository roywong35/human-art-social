import { Component, EventEmitter, Output, Inject, Optional, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { PostService } from '../../../../services/post.service';
import { AuthService } from '../../../../services/auth.service';
import { Router } from '@angular/router';
import { MatDialogModule } from '@angular/material/dialog';
import { ScheduleModalComponent } from '../schedule-modal/schedule-modal.component';
import { ScheduleIconComponent } from '../../../shared/schedule-icon/schedule-icon.component';
import { DraftModalComponent } from '../draft-modal/draft-modal.component';

interface EvidenceFile {
  file: File;
  name: string;
  preview?: string;
}

@Component({
  selector: 'app-submit-drawing-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, ScheduleModalComponent, ScheduleIconComponent],
  templateUrl: './new-art-post-modal.html',
  styleUrls: ['./new-art-post-modal.scss']
})
export class NewArtPostModalComponent implements OnInit, OnDestroy {
  @Output() close = new EventEmitter<void>();
  
  content = '';
  artFile: File | null = null;
  artPreview: string | null = null;
  evidenceFiles: EvidenceFile[] = [];
  isSubmitting = false;
  error: string | null = null;
  
  // Schedule-related properties
  scheduledTime: Date | null = null;
  showScheduleModal = false;

  // File size limits in bytes
  private readonly MAX_ART_SIZE = 50 * 1024 * 1024; // 50MB
  private readonly MAX_TOTAL_EVIDENCE_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly MAX_EVIDENCE_FILES = 5;

  private resizeObserver?: ResizeObserver;

  constructor(
    private postService: PostService,
    public authService: AuthService,
    private router: Router,
    private dialog: MatDialog,
    @Optional() private dialogRef: MatDialogRef<NewArtPostModalComponent>
  ) {
    if (this.dialogRef) {
      // Configure dialog based on screen size
      this.resizeObserver = new ResizeObserver(entries => {
        const width = entries[0].contentRect.width;
        if (width < 688) {
          dialogRef.updatePosition({ left: '0', top: '0' });
          dialogRef.updateSize('100vw', '100vh');
          dialogRef.removePanelClass('rounded-2xl');
        } else {
          dialogRef.updatePosition();
          dialogRef.updateSize('600px', 'auto');
          dialogRef.addPanelClass('rounded-2xl');
        }
      });
    }
  }

  ngOnInit(): void {
    // Start observing window size if dialog exists
    if (this.dialogRef && this.resizeObserver) {
      this.resizeObserver.observe(document.body);
    }
  }

  ngOnDestroy(): void {
    // Clean up resize observer if it exists
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  closeModal(result?: boolean): void {
    if (this.dialogRef) {
      this.dialogRef.close(result);
    } else {
      this.close.emit();
    }
  }

  onArtSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > this.MAX_ART_SIZE) {
      this.error = `Artwork file size must be less than ${this.MAX_ART_SIZE / (1024 * 1024)}MB`;
      return;
    }

    this.artFile = file;
    // Create preview URL for image files
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.artPreview = e.target.result;
      };
      reader.readAsDataURL(file);
    } else {
      // For non-image files (like PSD), show a placeholder
      this.artPreview = 'assets/file-preview-placeholder.png';
    }
  }

  removeArt(): void {
    this.artFile = null;
    this.artPreview = null;
  }

  onEvidenceSelected(event: any): void {
    const files = Array.from(event.target.files) as File[];
    
    // Check if adding these files would exceed the maximum count
    if (this.evidenceFiles.length + files.length > this.MAX_EVIDENCE_FILES) {
      this.error = `You can only upload up to ${this.MAX_EVIDENCE_FILES} evidence files`;
      return;
    }

    // Calculate total size including existing files
    const currentSize = this.evidenceFiles.reduce((total, ef) => total + ef.file.size, 0);
    const newSize = files.reduce((total, f) => total + f.size, 0);
    
    if (currentSize + newSize > this.MAX_TOTAL_EVIDENCE_SIZE) {
      this.error = `Total evidence files size must be less than ${this.MAX_TOTAL_EVIDENCE_SIZE / (1024 * 1024)}MB`;
      return;
    }

    // Process each file
    files.forEach(file => {
      const evidenceFile: EvidenceFile = {
        file,
        name: file.name
      };

      // Create preview for image files
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          evidenceFile.preview = e.target.result;
        };
        reader.readAsDataURL(file);
      }

      this.evidenceFiles.push(evidenceFile);
    });
  }

  removeEvidence(index: number): void {
    this.evidenceFiles.splice(index, 1);
  }

  async submitArt(): Promise<void> {
    if (!this.artFile) {
      this.error = 'Please select your artwork file.';
      return;
    }

    if (this.evidenceFiles.length === 0) {
      this.error = 'Please provide at least one evidence file.';
      return;
    }

    this.isSubmitting = true;
    this.error = null;

    const formData = new FormData();
    formData.append('content', this.content);
    
    // Use image_0 for the artwork
    formData.append('image_0', this.artFile);
    
    // Append evidence files with index to maintain order
    this.evidenceFiles.forEach((ef, index) => {
      formData.append(`evidence_file_${index}`, ef.file);
    });

    formData.append('is_human_drawing', 'true');
    formData.append('post_type', 'post');
    formData.append('evidence_count', this.evidenceFiles.length.toString());
    
    // Add scheduled time if set
    if (this.scheduledTime) {
      formData.append('scheduled_time', this.scheduledTime.toISOString());
    }

    console.log('Submitting post with files:', this.evidenceFiles);
    console.log('Art file details:', {
      name: this.artFile.name,
      type: this.artFile.type,
      size: this.artFile.size
    });
    console.log('Evidence files details:', this.evidenceFiles.map(file => ({
      name: file.name,
      type: file.file.type,
      size: file.file.size
    })));

    // Log FormData contents
    console.log('FormData contents:');
    formData.forEach((value, key) => {
      if (value instanceof File) {
        console.log(`${key}:`, {
          name: value.name,
          type: value.type,
          size: value.size
        });
      } else {
        console.log(`${key}:`, value);
      }
    });

    try {
      await this.postService.createPostWithFormData(formData).toPromise();
      // Refresh posts after successful submission
      this.postService.loadPosts(true);
      this.closeModal(true);
    } catch (error) {
      console.error('Error submitting art:', error);
      this.error = 'Failed to submit art. Please try again.';
    } finally {
      this.isSubmitting = false;
    }
  }

  // Schedule-related methods
  openScheduleModal(): void {
    this.showScheduleModal = true;
  }

  closeScheduleModal(): void {
    this.showScheduleModal = false;
  }

  onScheduleSelected(date: Date): void {
    this.scheduledTime = date;
    this.closeScheduleModal();
  }

  onViewScheduledPosts(): void {
    this.closeScheduleModal();
    this.closeModal();
    this.dialog.open(DraftModalComponent, {
      width: '90vw',
      maxWidth: '600px',
      height: '80vh',
      panelClass: ['draft-modal-dialog'],
      data: { selectedTab: 'scheduled' }
    });
  }

  onClearSchedule(): void {
    this.scheduledTime = null;
    this.closeScheduleModal();
  }

  formatScheduledTime(): string {
    if (!this.scheduledTime) return '';
    
    const now = new Date();
    const scheduled = new Date(this.scheduledTime);
    const diffTime = scheduled.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return scheduled.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return `Tomorrow at ${scheduled.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return scheduled.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }
} 