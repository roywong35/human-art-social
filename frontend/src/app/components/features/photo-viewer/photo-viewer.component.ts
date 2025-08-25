import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

interface PostImage {
  image: string;
  id?: number;
}

interface PhotoViewerData {
  photos: PostImage[];
  initialPhotoIndex: number;
}

@Component({
  selector: 'app-photo-viewer',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './photo-viewer.component.html',
  styleUrls: ['./photo-viewer.component.scss']
})
export class PhotoViewerComponent implements OnInit, OnDestroy {
  currentIndex: number;
  currentPhoto: PostImage | null = null;
  totalPhotos: number;
  defaultPlaceholder = 'assets/placeholder-image.svg';
  isPWAMode = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: PhotoViewerData,
    private dialogRef: MatDialogRef<PhotoViewerComponent>
  ) {
    this.currentIndex = data.initialPhotoIndex;
    this.totalPhotos = data.photos?.length || 0;
    this.currentPhoto = data.photos?.[this.currentIndex] || null;
  }

  ngOnInit() {
    document.body.style.overflow = 'hidden';
    // Check if running as PWA
    this.isPWAMode = window.matchMedia('(display-mode: standalone)').matches;
  }

  ngOnDestroy() {
    document.body.style.overflow = '';
  }

  close() {
    this.dialogRef.close();
  }

  nextPhoto() {
    if (this.currentIndex < this.totalPhotos - 1) {
      this.currentIndex++;
      this.currentPhoto = this.data.photos?.[this.currentIndex] || null;
    }
  }

  previousPhoto() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.currentPhoto = this.data.photos?.[this.currentIndex] || null;
    }
  }

  onImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.src = this.defaultPlaceholder;
  }
} 