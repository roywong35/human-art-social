import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, CUSTOM_ELEMENTS_SCHEMA, HostListener, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { EmojiPickerService } from '../../../../services/emoji-picker.service';
import { ScheduleModalComponent } from '../../../shared/schedule-modal/schedule-modal.component';
import { ScheduleIconComponent } from '../../../../components/shared/schedule-icon/schedule-icon.component';
import { MatDialog } from '@angular/material/dialog';
import { DraftModalComponent } from '../draft-modal/draft-modal.component';
import { HashtagService, HashtagResult } from '../../../../services/hashtag.service';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-post-input-box',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ScheduleIconComponent, ScheduleModalComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './post-input-box.component.html',
  styleUrls: ['./post-input-box.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PostInputBoxComponent {
  @Input() placeholder: string = "What's happening?";
  @Input() submitButtonText: string = 'Post';
  @Input() showCard: boolean = true; // Whether to show the card styling
  @Input() userAvatar: string = '';
  @Input() userHandle: string = '';
  @Input() defaultAvatar: string = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';
  @Input() startCompact: boolean = false; // Whether to start in compact mode

  @Output() submit = new EventEmitter<{ content: string, images?: File[], scheduledTime?: Date }>();
  @Output() imageSelected = new EventEmitter<File[]>();

  @ViewChild('textarea') textarea!: ElementRef;
  @ViewChild('postTextarea') postTextarea!: ElementRef<HTMLTextAreaElement>;

  protected content: string = '';
  protected inputFocused: boolean = false;
  protected showEmojiPicker: boolean = false;
  protected emojiPickerPosition = { top: 0, left: 0 };
  protected emojiPickerOpen = false;
  public images: { id: string, file: File, preview: string }[] = [];
  protected isCompact: boolean = false;
  protected scheduledTime: Date | undefined = undefined;
  protected showScheduleModal: boolean = false;

  // Hashtag autocomplete properties
  protected hashtagSuggestions: HashtagResult[] = [];
  protected showHashtagDropdown = false;
  protected selectedHashtagIndex = 0;
  protected currentHashtagQuery = '';
  protected hashtagDropdownPosition = { top: 0, left: 0 };
  private hashtagSubscription?: Subscription;

  constructor(
    private elementRef: ElementRef,
    private emojiPickerService: EmojiPickerService,
    private dialog: MatDialog,
    private hashtagService: HashtagService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.isCompact = this.startCompact;
    
    // Subscribe to emoji picker state
    this.emojiPickerService.pickerState$.subscribe(state => {
      this.emojiPickerOpen = state.show;
    });
  }

  ngOnDestroy() {
    if (this.hashtagSubscription) {
      this.hashtagSubscription.unsubscribe();
    }
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
    
    // Check for hashtag autocomplete
    this.checkForHashtagAutocomplete();
  }

  protected toggleEmojiPicker(event: MouseEvent) {
    event.stopPropagation();
    this.emojiPickerService.showPicker(event, event.target as HTMLElement, (emoji: any) => {
      this.content += emoji.emoji.native;
      this.cdr.detectChanges(); // Trigger change detection to update the textarea
    });
  }

  protected closeEmojiPickerBackdrop(): void {
    this.emojiPickerService.hidePicker();
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
      images: this.images.map(img => img.file),
      scheduledTime: this.scheduledTime
    });

    // Reset the input
    this.content = '';
    this.images.forEach(img => {
      URL.revokeObjectURL(img.preview);
    });
    this.images = [];
    this.scheduledTime = undefined;
    this.inputFocused = false;
    if (this.textarea) {
      this.textarea.nativeElement.style.height = 'auto';
    }
  }

  protected openScheduleModal(): void {
    this.showScheduleModal = true;
  }

  protected closeScheduleModal(): void {
    this.showScheduleModal = false;
  }

  protected onScheduleSelected(scheduledTime: Date): void {
    this.scheduledTime = scheduledTime;
    this.showScheduleModal = false;
  }

  protected onViewScheduledPosts(): void {
    this.showScheduleModal = false;
    this.dialog.open(DraftModalComponent, {
      width: '90vw',
      maxWidth: '600px',
      height: '80vh',
      panelClass: ['draft-modal-dialog'],
      data: { selectedTab: 'scheduled' }
    });
  }

  protected onClearSchedule(): void {
    this.scheduledTime = undefined;
    this.showScheduleModal = false;
  }

  protected clearSchedule(): void {
    this.scheduledTime = undefined;
  }

  protected getScheduledTimeDisplay(): string {
    if (!this.scheduledTime) return '';
    
    const now = new Date();
    const scheduled = new Date(this.scheduledTime);
    
    // Check if it's today
    if (scheduled.toDateString() === now.toDateString()) {
      return `Today at ${scheduled.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Check if it's tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (scheduled.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow at ${scheduled.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Otherwise show full date
    return scheduled.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  protected removeImage(id: string): void {
    const image = this.images.find(img => img.id === id);
    if (image) {
      URL.revokeObjectURL(image.preview);
      this.images = this.images.filter(img => img.id !== id);
    }
  }

  // Hashtag autocomplete methods
  private checkForHashtagAutocomplete(): void {
    const textarea = this.textarea?.nativeElement;
    if (!textarea) return;

    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = this.content.substring(0, cursorPosition);
    
    // Find the last hashtag before cursor
    const hashtagMatch = textBeforeCursor.match(/#(\w*)$/);
    
    if (hashtagMatch) {
      const hashtagQuery = hashtagMatch[1];
      this.currentHashtagQuery = hashtagQuery;
      
      if (hashtagQuery.length >= 1) {
        this.showHashtagSuggestions(hashtagQuery);
        this.positionHashtagDropdown();
      } else {
        this.hideHashtagDropdown();
      }
    } else {
      this.hideHashtagDropdown();
    }
  }

  private showHashtagSuggestions(query: string): void {
    // Cancel previous subscription
    if (this.hashtagSubscription) {
      this.hashtagSubscription.unsubscribe();
    }

    // Search for hashtags with debounce
    this.hashtagSubscription = this.hashtagService.searchHashtags(query)
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe({
        next: (response) => {
          this.hashtagSuggestions = response.results.slice(0, 5); // Limit to 5 suggestions
          this.showHashtagDropdown = this.hashtagSuggestions.length > 0;
          this.selectedHashtagIndex = 0;
        },
        error: (error) => {
          console.error('Error fetching hashtag suggestions:', error);
          this.hideHashtagDropdown();
        }
      });
  }

  private positionHashtagDropdown(): void {
    const textarea = this.textarea?.nativeElement;
    if (!textarea) return;

    const rect = textarea.getBoundingClientRect();
    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = this.content.substring(0, cursorPosition);
    
    // Calculate position based on cursor
    const textareaStyle = window.getComputedStyle(textarea);
    const lineHeight = parseInt(textareaStyle.lineHeight);
    const lines = textBeforeCursor.split('\n');
    const currentLine = lines[lines.length - 1];
    
    // Estimate cursor position
    const estimatedCursorX = currentLine.length * 8; // Rough estimate
    const estimatedCursorY = (lines.length - 1) * lineHeight;
    
    this.hashtagDropdownPosition = {
      top: rect.top + estimatedCursorY + lineHeight,
      left: rect.left + Math.min(estimatedCursorX, rect.width - 200)
    };
  }

  private hideHashtagDropdown(): void {
    this.showHashtagDropdown = false;
    this.hashtagSuggestions = [];
    this.selectedHashtagIndex = 0;
  }

  protected selectHashtag(hashtag: HashtagResult): void {
    const textarea = this.textarea?.nativeElement;
    if (!textarea) return;

    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = this.content.substring(0, cursorPosition);
    const textAfterCursor = this.content.substring(cursorPosition);
    
    // Find the hashtag to replace
    const hashtagMatch = textBeforeCursor.match(/#(\w*)$/);
    if (hashtagMatch) {
      const startPos = cursorPosition - hashtagMatch[0].length;
      const endPos = cursorPosition;
      
      // Replace the partial hashtag with the full one
      const newContent = this.content.substring(0, startPos) + 
                        '#' + hashtag.name + 
                        this.content.substring(endPos);
      
      this.content = newContent;
      
      // Set cursor position after the hashtag
      const newCursorPos = startPos + hashtag.name.length + 1;
      setTimeout(() => {
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      });
    }
    
    this.hideHashtagDropdown();
  }

  protected onHashtagKeydown(event: KeyboardEvent): void {
    if (!this.showHashtagDropdown) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedHashtagIndex = Math.min(
          this.selectedHashtagIndex + 1, 
          this.hashtagSuggestions.length - 1
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.selectedHashtagIndex = Math.max(this.selectedHashtagIndex - 1, 0);
        break;
      case 'Enter':
        event.preventDefault();
        if (this.hashtagSuggestions[this.selectedHashtagIndex]) {
          this.selectHashtag(this.hashtagSuggestions[this.selectedHashtagIndex]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        this.hideHashtagDropdown();
        break;
    }
  }
} 