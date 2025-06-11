import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ImageFile {
  file: File;
  preview: string;
  id: string;
}

export interface ImageValidationError {
  code: 'MAX_FILES' | 'FILE_SIZE' | 'FILE_TYPE' | 'DIMENSIONS';
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class ImageUploadService {
  private readonly MAX_FILES = 4;
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  private images = new BehaviorSubject<ImageFile[]>([]);
  private errors = new BehaviorSubject<ImageValidationError[]>([]);

  constructor() {}

  get images$(): Observable<ImageFile[]> {
    return this.images.asObservable();
  }

  get errors$(): Observable<ImageValidationError[]> {
    return this.errors.asObservable();
  }

  async addImages(files: FileList): Promise<void> {
    const newFiles = Array.from(files);
    const currentImages = this.images.value;
    const errors: ImageValidationError[] = [];

    // Check total files limit
    if (currentImages.length + newFiles.length > this.MAX_FILES) {
      errors.push({
        code: 'MAX_FILES',
        message: `Maximum ${this.MAX_FILES} images allowed`
      });
      this.errors.next(errors);
      return;
    }

    // Process each file
    const processedFiles = await Promise.all(
      newFiles.map(async (file) => {
        // Validate file
        if (!this.validateFileType(file)) {
          errors.push({
            code: 'FILE_TYPE',
            message: `File type not supported: ${file.name}`
          });
          return null;
        }

        if (!this.validateFileSize(file)) {
          errors.push({
            code: 'FILE_SIZE',
            message: `File too large: ${file.name}`
          });
          return null;
        }

        // Generate preview
        const preview = await this.generatePreview(file);
        
        return {
          file,
          preview,
          id: crypto.randomUUID()
        };
      })
    );

    // Update errors if any
    if (errors.length > 0) {
      this.errors.next(errors);
    }

    // Add valid files to the collection
    const validFiles = processedFiles.filter((file): file is NonNullable<typeof file> => file !== null);
    this.images.next([...currentImages, ...validFiles]);
  }

  removeImage(imageId: string): void {
    const currentImages = this.images.value;
    const imageToRemove = currentImages.find(img => img.id === imageId);
    
    if (imageToRemove) {
      // Revoke the object URL to prevent memory leaks
      URL.revokeObjectURL(imageToRemove.preview);
      
      // Remove the image from the array
      this.images.next(currentImages.filter(img => img.id !== imageId));
    }

    // Clear any existing errors
    this.errors.next([]);
  }

  clearImages(): void {
    // Revoke all object URLs
    this.images.value.forEach(img => {
      URL.revokeObjectURL(img.preview);
    });
    
    // Clear the images array
    this.images.next([]);
    
    // Clear any errors
    this.errors.next([]);
  }

  getLayoutClass(index: number, totalImages: number): string {
    if (totalImages === 1) {
      return 'w-full h-full';
    }
    
    if (totalImages === 2) {
      return 'w-1/2 h-full';
    }
    
    if (totalImages === 3) {
      if (index === 0) {
        return 'w-full h-1/2';
      }
      return 'w-1/2 h-1/2';
    }
    
    // For 4 images
    return 'w-1/2 h-1/2';
  }

  private validateFileType(file: File): boolean {
    return this.ALLOWED_TYPES.includes(file.type);
  }

  private validateFileSize(file: File): boolean {
    return file.size <= this.MAX_FILE_SIZE;
  }

  private async generatePreview(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.readAsDataURL(file);
    });
  }
} 