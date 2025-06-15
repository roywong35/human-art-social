import { Component, Inject, ViewChild, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { Post } from '../../models/post.model';
import { User } from '../../models/user.model';
import { CommentService } from '../../services/comment.service';
import { TimeAgoPipe } from '../../pipes/time-ago.pipe';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { Router } from '@angular/router';
import { EmojiPickerService } from '../../services/emoji-picker.service';
import { EmojiPickerComponent } from '../shared/emoji-picker/emoji-picker.component';

@Component({
  selector: 'app-comment-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, TimeAgoPipe, PickerComponent, EmojiPickerComponent],
  templateUrl: './comment-dialog.component.html',
  styleUrls: ['./comment-dialog.component.scss']
})
export class CommentDialogComponent implements OnInit {
  @ViewChild('replyTextarea') textarea!: ElementRef;
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';
  protected replyContent = '';
  protected textareaRows = 1;
  protected showEmojiPicker = false;
  protected emojiPickerPosition = { top: 0, left: 0 };
  protected comments: Post[] = [];
  protected selectedImage: File | null = null;
  protected imagePreview: string | null = null;
  protected isSubmitting = false;

  constructor(
    public dialogRef: MatDialogRef<CommentDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { post: Post; currentUser: User | null },
    private commentService: CommentService,
    private router: Router,
    private emojiPickerService: EmojiPickerService
  ) {}

  ngOnInit(): void {
    this.loadComments();
  }

  loadComments(): void {
    this.commentService.getComments(this.data.post.author.handle, this.data.post.id).subscribe({
      next: (comments) => {
        this.comments = comments;
      },
      error: (error) => {
        console.error('Error loading comments:', error);
      }
    });
  }

  adjustTextarea(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
    this.textareaRows = Math.min(Math.max(Math.ceil(textarea.scrollHeight / 24), 1), 10);
  }

  toggleEmojiPicker(event: MouseEvent) {
    event.stopPropagation();
    this.emojiPickerService.showPicker(event, event.target as HTMLElement, (emoji: any) => {
      this.replyContent += emoji.emoji.native;
    });
  }

  onImageClick(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) {
        this.selectedImage = file;
        const reader = new FileReader();
        reader.onload = () => {
          this.imagePreview = reader.result as string;
        };
        reader.readAsDataURL(file);
      }
    };
    
    input.click();
  }

  removeImage(): void {
    this.selectedImage = null;
    this.imagePreview = null;
  }

  onSubmit(): void {
    if (!this.replyContent.trim() && !this.selectedImage) {
      return;
    }

    this.isSubmitting = true;
    const formData = new FormData();
    formData.append('content', this.replyContent);
    if (this.selectedImage) {
      formData.append('image', this.selectedImage);
    }

    this.commentService.createComment(this.data.post.author.handle, this.data.post.id, this.replyContent).subscribe({
      next: (comment) => {
        this.isSubmitting = false;
        this.dialogRef.close(comment);
      },
      error: (error) => {
        console.error('Error creating comment:', error);
        this.isSubmitting = false;
      }
    });
  }
} 