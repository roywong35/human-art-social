import { Component, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { PostService } from '../../services/post.service';
import { AuthService } from '../../services/auth.service';
import { TimeAgoPipe } from '../../pipes/time-ago.pipe';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';

@Component({
  selector: 'app-new-post-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TimeAgoPipe, PickerComponent],
  templateUrl: './new-post-modal.component.html',
  styleUrls: ['./new-post-modal.component.scss']
})
export class NewPostModalComponent {
  @ViewChild('postTextarea') postTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  
  protected content = '';
  protected selectedImage: File | undefined;
  protected selectedImagePreview: string | null = null;
  protected isSubmitting = false;
  protected error: string | null = null;
  protected showEmojiPicker = false;
  protected emojiPickerPosition = { top: 0, left: 0 };
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  constructor(
    public dialogRef: MatDialogRef<NewPostModalComponent>,
    private postService: PostService,
    public authService: AuthService
  ) {}

  async createPost(): Promise<void> {
    if (this.content.trim() || this.selectedImage) {
      try {
        this.isSubmitting = true;
        this.error = null;
        await this.postService.createPost(this.content, this.selectedImage).toPromise();
        this.dialogRef.close(true);
      } catch (error) {
        console.error('Error creating post:', error);
        this.error = 'Failed to create post. Please try again.';
      } finally {
        this.isSubmitting = false;
      }
    }
  }

  closeModal() {
    this.dialogRef.close();
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.selectedImage = file;
      const reader = new FileReader();
      reader.onload = () => {
        this.selectedImagePreview = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage(): void {
    this.selectedImage = undefined;
    this.selectedImagePreview = null;
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  toggleEmojiPicker(event: MouseEvent): void {
    event.stopPropagation();
    this.showEmojiPicker = !this.showEmojiPicker;
    if (this.showEmojiPicker) {
      const button = event.target as HTMLElement;
      const rect = button.getBoundingClientRect();
      this.emojiPickerPosition = {
        top: rect.bottom + window.scrollY + 10,
        left: rect.left + window.scrollX
      };
    }
  }

  addEmoji(event: any): void {
    const emoji = event.emoji.native;
    const textarea = this.postTextarea.nativeElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    this.content = this.content.substring(0, start) + emoji + this.content.substring(end);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
    this.showEmojiPicker = false;
  }

  adjustTextareaHeight(event: any): void {
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }
} 