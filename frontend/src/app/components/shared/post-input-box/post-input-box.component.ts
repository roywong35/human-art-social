import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, CUSTOM_ELEMENTS_SCHEMA, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { MatDialog } from '@angular/material/dialog';
import { EmojiPickerService } from '../../../services/emoji-picker.service';
import { EmojiPickerComponent } from '../../shared/emoji-picker/emoji-picker.component';

@Component({
  selector: 'app-post-input-box',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  @Output() submit = new EventEmitter<{ content: string, images?: File[] }>();
  @Output() imageSelected = new EventEmitter<File[]>();

  @ViewChild('textarea') textarea!: ElementRef;
  @ViewChild('postTextarea') postTextarea!: ElementRef<HTMLTextAreaElement>;

  protected content: string = '';
  protected inputFocused: boolean = false;
  protected showEmojiPicker: boolean = false;
  protected emojiPickerPosition = { top: 0, left: 0 };
  public images: { id: string, file: File, preview: string }[] = [];
  protected isCompact: boolean = false;

  constructor(
    private dialog: MatDialog,
    private elementRef: ElementRef,
    private emojiPickerService: EmojiPickerService
  ) {}

  ngOnInit() {
    this.isCompact = this.startCompact;
  }

  protected get canSubmit(): boolean {
    return this.content.trim().length > 0 || this.images.length > 0;
  }

  protected getImageLayoutClass(index: number): string {
    if (this.images.length === 1) return 'w-full h-full';
    if (this.images.length === 2) return 'w-1/2 h-full';
    if (this.images.length === 3) return 'w-1/2 h-full';
    if (this.images.length === 4) return 'w-1/2 h-1/2';
    return '';
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

  protected toggleEmojiPicker(event: MouseEvent) {
    event.stopPropagation();
    this.emojiPickerService.showPicker(event, event.target as HTMLElement, (emoji: any) => {
      this.content += emoji.emoji.native;
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
        this.imageSelected.emit(this.images.map(img => img.file));
      }
    };
    
    input.click();
  }

  protected onSubmit(): void {
    if (!this.canSubmit) return;

    this.submit.emit({
      content: this.content,
      images: this.images.map(img => img.file)
    });

    // Reset the input
    this.content = '';
    this.images.forEach(img => {
      URL.revokeObjectURL(img.preview);
    });
    this.images = [];
    this.inputFocused = false;
    if (this.textarea) {
      this.textarea.nativeElement.style.height = 'auto';
    }
  }

  protected removeImage(id: string): void {
    const image = this.images.find(img => img.id === id);
    if (image) {
      URL.revokeObjectURL(image.preview);
      this.images = this.images.filter(img => img.id !== id);
    }
  }
} 