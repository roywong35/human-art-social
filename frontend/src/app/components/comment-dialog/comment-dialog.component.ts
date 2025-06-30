import { Component, Inject, ViewChild, ElementRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { Post } from '../../models/post.model';
import { User } from '../../models/user.model';
import { CommentService } from '../../services/comment.service';
import { TimeAgoPipe } from '../../pipes/time-ago.pipe';
import { Router } from '@angular/router';
import { EmojiPickerService } from '../../services/emoji-picker.service';

@Component({
  selector: 'app-comment-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, TimeAgoPipe],
  templateUrl: './comment-dialog.component.html',
  styleUrls: ['./comment-dialog.component.scss']
})
export class CommentDialogComponent implements OnInit, OnDestroy {
  @ViewChild('replyTextarea') textarea!: ElementRef;
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';
  protected replyContent = '';
  protected textareaRows = 1;
  protected showEmojiPicker = false;
  protected emojiPickerPosition = { top: 0, left: 0 };
  protected comments: Post[] = [];
  public images: { id: string, file: File, preview: string }[] = [];
  protected isSubmitting = false;
  private resizeObserver: ResizeObserver;

  constructor(
    public dialogRef: MatDialogRef<CommentDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { post: Post; currentUser: User | null },
    private commentService: CommentService,
    private router: Router,
    private emojiPickerService: EmojiPickerService
  ) {
    // Configure dialog based on screen size
    this.resizeObserver = new ResizeObserver(entries => {
      const width = entries[0].contentRect.width;
      if (width < 688) {
        dialogRef.updatePosition({ left: '0', top: '0' });
        dialogRef.updateSize('100vw', '100vh');
      } else {
        dialogRef.updatePosition();
        dialogRef.updateSize('600px', 'auto');
      }
    });
  }

  ngOnInit(): void {
    this.loadComments();
    // Start observing window size
    this.resizeObserver.observe(document.body);
  }

  ngOnDestroy(): void {
    this.resizeObserver.disconnect();
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

  protected getImageLayoutClass(index: number): string {
    if (this.images.length === 1) return 'w-full h-full';
    if (this.images.length === 2) return 'w-1/2 h-full';
    if (this.images.length === 3) return 'w-1/2 h-full';
    if (this.images.length === 4) return 'w-1/2 h-1/2';
    return '';
  }

  onImageClick(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const files = target.files;
      
      if (files) {
        const newFiles = Array.from(files).slice(0, 4 - this.images.length);
        newFiles.forEach(file => {
          const id = Math.random().toString(36).substring(7);
          this.images.push({
            id,
            file,
            preview: URL.createObjectURL(file)
          });
        });
      }
    };
    
    input.click();
  }

  removeImage(id: string): void {
    const image = this.images.find(img => img.id === id);
    if (image) {
      URL.revokeObjectURL(image.preview);
      this.images = this.images.filter(img => img.id !== id);
    }
  }

  onSubmit(): void {
    if (!this.replyContent.trim() && this.images.length === 0) {
      return;
    }

    this.isSubmitting = true;
    const formData = new FormData();
    formData.append('content', this.replyContent);
    this.images.forEach((image, index) => {
      formData.append(`image_${index}`, image.file);
    });

    this.commentService.createComment(
      this.data.post.author.handle, 
      this.data.post.id, 
      this.replyContent,
      this.images.length > 0 ? formData : undefined
    ).subscribe({
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