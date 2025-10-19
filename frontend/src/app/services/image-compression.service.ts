import { Injectable } from '@angular/core';

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ImageCompressionService {
  
  // Recommended settings based on use case
  private readonly PRESETS = {
    POST: { maxWidth: 1920, maxHeight: 1920, quality: 0.8, mimeType: 'image/jpeg' },
    PROFILE_PICTURE: { maxWidth: 512, maxHeight: 512, quality: 0.9, mimeType: 'image/jpeg' },
    BANNER: { maxWidth: 1920, maxHeight: 1080, quality: 0.8, mimeType: 'image/jpeg' },
    CHAT: { maxWidth: 1920, maxHeight: 1920, quality: 0.8, mimeType: 'image/jpeg' }
  };

  /**
   * Compress an image file
   * @param file Original image file
   * @param options Compression options or preset name
   * @returns Promise<File> Compressed image file
   */
  async compressImage(
    file: File,
    options: CompressionOptions | 'POST' | 'PROFILE_PICTURE' | 'BANNER' | 'CHAT' = 'POST'
  ): Promise<File> {
    // Get compression options
    const opts = typeof options === 'string' ? this.PRESETS[options] : options;
    
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        try {
          // Calculate new dimensions while maintaining aspect ratio
          const { width, height } = this.calculateDimensions(
            img.width,
            img.height,
            opts.maxWidth || 1920,
            opts.maxHeight || 1920
          );
          
          canvas.width = width;
          canvas.height = height;
          
          // Draw image on canvas with new dimensions
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Convert canvas to blob
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }
              
              // Create new File from blob
              const compressedFile = new File(
                [blob],
                file.name,
                {
                  type: opts.mimeType || 'image/jpeg',
                  lastModified: Date.now()
                }
              );
              
              // Log compression ratio
              const originalSize = (file.size / 1024 / 1024).toFixed(2);
              const compressedSize = (compressedFile.size / 1024 / 1024).toFixed(2);
              const ratio = ((1 - compressedFile.size / file.size) * 100).toFixed(1);
              
              console.log(`Image compressed: ${originalSize}MB → ${compressedSize}MB (${ratio}% reduction)`);
              
              resolve(compressedFile);
            },
            opts.mimeType || 'image/jpeg',
            opts.quality || 0.8
          );
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      // Load image
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Compress multiple images in parallel
   */
  async compressImages(
    files: File[],
    options: CompressionOptions | 'POST' | 'PROFILE_PICTURE' | 'BANNER' | 'CHAT' = 'POST'
  ): Promise<File[]> {
    return Promise.all(files.map(file => this.compressImage(file, options)));
  }

  /**
   * Calculate new dimensions while maintaining aspect ratio
   */
  private calculateDimensions(
    width: number,
    height: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    if (width <= maxWidth && height <= maxHeight) {
      return { width, height };
    }
    
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    
    return {
      width: Math.round(width * ratio),
      height: Math.round(height * ratio)
    };
  }

  /**
   * Check if file is an image
   */
  isImage(file: File): boolean {
    return file.type.startsWith('image/');
  }
}
