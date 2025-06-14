import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, CUSTOM_ELEMENTS_SCHEMA, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-post-input-box',
  standalone: true,
  imports: [CommonModule, FormsModule, PickerComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './post-input-box.component.html',
  styleUrls: ['./post-input-box.component.scss']
})
export class PostInputBoxComponent {
  @Input() placeholder: string = "What's happening?";
  @Input() submitButtonText: string = 'Post';
  @Input() showCard: boolean = true; // Whether to show the card styling
  @Input() userAvatar: string = '';
  @Input() defaultAvatar: string = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';
  @Input() startCompact: boolean = false; // Whether to start in compact mode

  @Output() submit = new EventEmitter<{ content: string, image?: File }>();
  @Output() imageSelected = new EventEmitter<File>();

  @ViewChild('textarea') textarea!: ElementRef;
  @ViewChild('postTextarea') postTextarea!: ElementRef<HTMLTextAreaElement>;

  protected content: string = '';
  protected inputFocused: boolean = false;
  protected showEmojiPicker: boolean = false;
  protected emojiPickerPosition = { top: 0, left: 0 };
  protected selectedImage: File | null = null;
  protected selectedImageUrl: string | null = null;
  protected isCompact: boolean = false;

  constructor(
    private dialog: MatDialog,
    private elementRef: ElementRef
  ) {}

  ngOnInit() {
    this.isCompact = this.startCompact;
  }

  protected get canSubmit(): boolean {
    return this.content.trim().length > 0 || !!this.selectedImage;
  }

  protected expandInput(): void {
    if (this.isCompact) {
      this.isCompact = false;
      setTimeout(() => {
        this.textarea?.nativeElement.focus();
      });
    }
  }

  protected adjustTextareaHeight(event: any): void {
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  protected toggleEmojiPicker(event: MouseEvent): void {
    console.log('Toggle emoji picker called');
    event.stopPropagation();
    const buttonElement = event.currentTarget as HTMLElement;
    const rect = buttonElement.getBoundingClientRect();
    
    console.log('Button position:', rect);
    
    // Calculate position relative to viewport
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const pickerHeight = 435; // Height of the emoji picker
    
    // Position above if not enough space below
    const top = spaceBelow < pickerHeight && rect.top > pickerHeight
      ? rect.top - pickerHeight - 5
      : rect.bottom + 5;
    
    this.emojiPickerPosition = {
      top: rect.bottom,
      left: rect.left - 120
    };
    
    console.log('Emoji picker position:', this.emojiPickerPosition);
    
    this.showEmojiPicker = !this.showEmojiPicker;
    console.log('Show emoji picker:', this.showEmojiPicker);
  }

  protected addEmoji(event: any): void {
    console.log('addEmoji called with event:', event);
    console.log('Current textarea reference:', this.textarea);
    console.log('Current content:', this.content);

    if (!event.emoji || !event.emoji.native) {
      console.error('Invalid emoji event:', event);
      return;
    }
    
    const emoji = event.emoji.native;
    console.log('Adding emoji:', emoji);

    if (!this.textarea?.nativeElement) {
      console.error('Textarea element not found');
      return;
    }

    const textarea = this.textarea.nativeElement;
    console.log('Textarea element found:', textarea);
    console.log('Selection - start:', textarea.selectionStart, 'end:', textarea.selectionEnd);

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    this.content = this.content.substring(0, start) + emoji + this.content.substring(end);
    console.log('Updated content:', this.content);
    
    // Set cursor position after emoji
    setTimeout(() => {
      console.log('Setting cursor position after emoji');
      textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
      textarea.focus();
    });
  }

  @HostListener('document:click', ['$event'])
  handleClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    
    // Only handle clicks within this component
    if (!this.elementRef.nativeElement.contains(target)) {
      return;
    }
    
    console.log('PostInputBox: Document click - target:', target);
    
    // Check if click is inside emoji picker or trigger
    const isEmojiPicker = target.closest('.emoji-picker-wrapper') || 
                         target.closest('.emoji-mart') ||
                         target.closest('emoji-mart') ||
                         target.closest('.emoji-trigger');
    
    if (!isEmojiPicker) {
      this.showEmojiPicker = false;
    }
  }

  protected onImageClick(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      
      if (file) {
        this.selectedImage = file;
        this.selectedImageUrl = URL.createObjectURL(file);
        this.imageSelected.emit(file);
      }
    };
    
    input.click();
  }

  protected onSubmit(): void {
    if (!this.canSubmit) return;

    this.submit.emit({
      content: this.content,
      image: this.selectedImage || undefined
    });

    // Reset the input
    this.content = '';
    if (this.selectedImageUrl) {
      URL.revokeObjectURL(this.selectedImageUrl);
    }
    this.selectedImage = null;
    this.selectedImageUrl = null;
    this.inputFocused = false;
    if (this.textarea) {
      this.textarea.nativeElement.style.height = 'auto';
    }
  }

  protected removeImage(): void {
    if (this.selectedImageUrl) {
      URL.revokeObjectURL(this.selectedImageUrl);
    }
    this.selectedImage = null;
    this.selectedImageUrl = null;
  }
} 