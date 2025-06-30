import { Component, ViewChild, ElementRef, OnDestroy, Inject, Optional, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { PostService } from '../../services/post.service';
import { AuthService } from '../../services/auth.service';
import { TimeAgoPipe } from '../../pipes/time-ago.pipe';
import { ImageUploadService, ImageFile } from '../../services/image-upload.service';
import { Subscription } from 'rxjs';
import { Post } from '../../models/post.model';
import { EmojiPickerService } from '../../services/emoji-picker.service';
import { PhotoViewerComponent } from '../photo-viewer/photo-viewer.component';
import { environment } from '../../../environments/environment';

interface DialogData {
  quotePost?: Post;
}

@Component({
  selector: 'app-new-post-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    TimeAgoPipe
  ],
  templateUrl: './new-post-modal.component.html',
  styleUrls: ['./new-post-modal.component.scss']
})
export class NewPostModalComponent implements OnInit, OnDestroy {
  @ViewChild('postTextarea') postTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  
  protected content = '';
  protected isSubmitting = false;
  protected error: string | null = null;
  protected showEmojiPicker = false;
  protected emojiPickerPosition = { top: 0, left: 0 };
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';
  protected environment = environment;

  protected images: ImageFile[] = [];
  private subscriptions: Subscription = new Subscription();
  protected quotePost: Post | undefined;
  private resizeObserver: ResizeObserver;

  constructor(
    public dialogRef: MatDialogRef<NewPostModalComponent>,
    private postService: PostService,
    private emojiPickerService: EmojiPickerService,
    public authService: AuthService,
    private imageUploadService: ImageUploadService,
    private dialog: MatDialog,
    @Optional() @Inject(MAT_DIALOG_DATA) private data?: DialogData
  ) {
    this.quotePost = data?.quotePost;

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

    // Subscribe to image updates
    this.subscriptions.add(
      this.imageUploadService.images$.subscribe(images => {
        this.images = images;
      })
    );

    // Subscribe to error updates
    this.subscriptions.add(
      this.imageUploadService.errors$.subscribe(errors => {
        if (errors.length > 0) {
          this.error = errors[0].message;
        } else {
          this.error = null;
        }
      })
    );
  }

  ngOnInit(): void {
    // Start observing window size
    this.resizeObserver.observe(document.body);
  }

  ngOnDestroy() {
    this.resizeObserver.disconnect();
    this.subscriptions.unsubscribe();
    this.imageUploadService.clearImages();
  }

  protected getBaseUrl(): string {
    return window.location.origin;
  }

  protected getDisplayUrl(): string {
    return window.location.origin.replace('https://', '').replace('http://', '');
  }

  protected async createPost() {
    if (this.isSubmitting) return;
    this.isSubmitting = true;
    this.error = null;

    try {
      let post: Post;
      if (this.quotePost) {
        // Create quote post
        const response = await this.postService.createQuotePost(
          this.content,
          this.quotePost.author.handle,
          this.quotePost.id,
          this.images.map(img => img.file)
        ).toPromise();
        if (!response) throw new Error('Failed to create quote post');
        post = response;
      } else {
        // Create regular post
        const response = await this.postService.createPost(
          this.content,
          this.images.map(img => img.file)
        ).toPromise();
        if (!response) throw new Error('Failed to create post');
        post = response;
      }

      this.dialogRef.close(post);
      window.location.reload();
    } catch (error) {
      console.error('Error creating post:', error);
      this.error = 'Failed to create post. Please try again.';
    } finally {
      this.isSubmitting = false;
    }
  }

  closeModal() {
    this.dialogRef.close();
  }

  async onImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      await this.imageUploadService.addImages(input.files);
      // Clear the input so the same file can be selected again
      input.value = '';
    }
  }

  removeImage(imageId: string): void {
    this.imageUploadService.removeImage(imageId);
  }

  toggleEmojiPicker(event: MouseEvent) {
    event.stopPropagation();
    this.emojiPickerService.showPicker(event, event.target as HTMLElement, (emoji: any) => {
      this.content += emoji.emoji.native;
    });
  }

  adjustTextareaHeight(event: any): void {
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  getImageLayoutClass(index: number): string {
    if (this.images.length === 1) {
      return 'w-full h-full';
    } else if (this.images.length === 2) {
      return 'w-1/2 h-full';
    } else if (this.images.length === 3) {
      if (index === 0) {
        return 'w-1/2 h-full';
      } else {
        return 'w-1/2 h-1/2';
      }
    } else if (this.images.length === 4) {
      return 'w-1/2 h-1/2';
    }
    return '';
  }

  protected onPhotoClick(event: Event, index: number, sourcePost?: Post): void {
    event.stopPropagation();
    const post = sourcePost || { images: this.images.map(img => ({ image: img.preview })) };
    const images = post.images?.map(img => img.image) || [];
    this.dialog.open(PhotoViewerComponent, {
      width: '100vw',
      height: '100vh',
      maxWidth: '100vw',
      maxHeight: '100vh',
      panelClass: 'photo-viewer-dialog',
      data: {
        images: images,
        currentIndex: index
      }
    });
  }

  protected onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = this.defaultAvatar;
  }
} 