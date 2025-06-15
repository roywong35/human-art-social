import { Component, ViewChild, ElementRef, OnDestroy, Inject, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { PostService } from '../../services/post.service';
import { AuthService } from '../../services/auth.service';
import { TimeAgoPipe } from '../../pipes/time-ago.pipe';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { ImageUploadService, ImageFile } from '../../services/image-upload.service';
import { Subscription } from 'rxjs';
import { Post } from '../../models/post.model';
import { EmojiPickerService } from '../../services/emoji-picker.service';
import { EmojiPickerComponent } from '../shared/emoji-picker/emoji-picker.component';

interface DialogData {
  quotePost?: Post;
}

@Component({
  selector: 'app-new-post-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TimeAgoPipe, PickerComponent, MatDialogModule, EmojiPickerComponent],
  templateUrl: './new-post-modal.component.html',
  styleUrls: ['./new-post-modal.component.scss']
})
export class NewPostModalComponent implements OnDestroy {
  @ViewChild('postTextarea') postTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  
  protected content = '';
  protected isSubmitting = false;
  protected error: string | null = null;
  protected showEmojiPicker = false;
  protected emojiPickerPosition = { top: 0, left: 0 };
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  protected images: ImageFile[] = [];
  private subscriptions: Subscription = new Subscription();
  protected quotePost: Post | undefined;

  constructor(
    public dialogRef: MatDialogRef<NewPostModalComponent>,
    private postService: PostService,
    private emojiPickerService: EmojiPickerService,
    public authService: AuthService,
    private imageUploadService: ImageUploadService,
    @Optional() @Inject(MAT_DIALOG_DATA) private data?: DialogData
  ) {
    this.quotePost = data?.quotePost;

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

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    this.imageUploadService.clearImages();
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
    this.emojiPickerService.showPicker(event);
  }

  addEmoji(emoji: any) {
    this.emojiPickerService.onEmojiSelect(emoji, (selectedEmoji) => {
      const textarea = this.postTextarea.nativeElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      
      this.content = 
        this.content.substring(0, start) + 
        selectedEmoji.emoji.native +
        this.content.substring(end);
      
      // Set cursor position after emoji
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + selectedEmoji.emoji.native.length;
        textarea.focus();
      });
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
} 