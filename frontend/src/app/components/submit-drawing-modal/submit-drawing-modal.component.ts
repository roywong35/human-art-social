import { Component, EventEmitter, Output, Inject, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { PostService } from '../../services/post.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { MatDialogModule } from '@angular/material/dialog';

interface EvidenceFile {
  file: File;
  name: string;
  preview?: string;
}

@Component({
  selector: 'app-submit-drawing-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './submit-drawing-modal.component.html',
  styleUrls: ['./submit-drawing-modal.component.scss']
})
export class SubmitDrawingModalComponent {
  @Output() close = new EventEmitter<void>();
  
  content = '';
  artFile: File | null = null;
  artPreview: string | null = null;
  evidenceFiles: EvidenceFile[] = [];
  isSubmitting = false;
  error: string | null = null;

  // File size limits in bytes
  private readonly MAX_ART_SIZE = 50 * 1024 * 1024; // 50MB
  private readonly MAX_TOTAL_EVIDENCE_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly MAX_EVIDENCE_FILES = 5;

  constructor(
    private postService: PostService,
    public authService: AuthService,
    private router: Router,
    @Optional() private dialogRef: MatDialogRef<SubmitDrawingModalComponent>
  ) {}

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
    
    // Use the new image format for the artwork
    formData.append('image_0', this.artFile);
    
    // Append evidence files with index to maintain order
    this.evidenceFiles.forEach((ef, index) => {
      formData.append(`evidence_file_${index}`, ef.file);
    });

    formData.append('is_human_drawing', 'true');
    formData.append('post_type', 'post');
    formData.append('evidence_count', this.evidenceFiles.length.toString());

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

    this.postService.createPostWithFormData(formData).subscribe({
      next: (response) => {
        console.log('Post created successfully:', response);
        this.isSubmitting = false;
        this.closeModal(true);
      },
      error: (error) => {
        console.error('Error creating post:', error);
        this.error = 'Failed to submit artwork. Please try again.';
        this.isSubmitting = false;
      }
    });
  }
} 