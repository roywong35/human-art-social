import { Component, Inject, ViewChild, ElementRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { Post } from '../../../../models/post.model';
import { User } from '../../../../models/user.model';
import { CommentService } from '../../../../services/comment.service';
import { TimeAgoPipe } from '../../../../pipes/time-ago.pipe';
import { Router } from '@angular/router';
import { EmojiPickerService } from '../../../../services/emoji-picker.service';
import { ScheduleIconComponent } from '../../../shared/schedule-icon/schedule-icon.component';
import { ScheduleModalComponent } from '../../../shared/schedule-modal/schedule-modal.component';
import { DraftModalComponent } from '../../posts/draft-modal/draft-modal.component';
import { HashtagDirective } from '../../../../directives/hashtag.directive';
import { HashtagService, HashtagResult } from '../../../../services/hashtag.service';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-comment-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, TimeAgoPipe, ScheduleIconComponent, ScheduleModalComponent, HashtagDirective],
  templateUrl: './comment-dialog.component.html',
  styleUrls: ['./comment-dialog.component.scss']
})
export class CommentDialogComponent implements OnInit, OnDestroy {
  @ViewChild('replyTextarea') replyTextarea!: ElementRef;
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';
  protected replyContent = '';
  protected textareaRows = 1;
  protected showEmojiPicker = false;
  protected emojiPickerPosition = { top: 0, left: 0 };
  protected emojiPickerOpen = false;
  protected comments: Post[] = [];
  public images: { id: string, file: File, preview: string }[] = [];
  protected isSubmitting = false;
  private resizeObserver: ResizeObserver;
  
  // Schedule-related properties
  protected scheduledTime: Date | null = null;
  protected showScheduleModal: boolean = false;

  // Hashtag autocomplete properties
  protected hashtagSuggestions: HashtagResult[] = [];
  protected showHashtagDropdown = false;
  protected selectedHashtagIndex = 0;
  protected currentHashtagQuery = '';
  protected hashtagDropdownPosition = { top: 0, left: 0 };
  private hashtagSubscription?: Subscription;

  constructor(
    public dialogRef: MatDialogRef<CommentDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { post: Post; currentUser: User | null },
    private commentService: CommentService,
    private router: Router,
    private emojiPickerService: EmojiPickerService,
    private dialog: MatDialog,
    private hashtagService: HashtagService
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
    
    // Subscribe to emoji picker state
    this.emojiPickerService.pickerState$.subscribe(state => {
      this.emojiPickerOpen = state.show;
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver.disconnect();
    
    if (this.hashtagSubscription) {
      this.hashtagSubscription.unsubscribe();
    }
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
    
    // Check for hashtag autocomplete
    this.checkForHashtagAutocomplete();
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

  // Helpers for showing referenced (quoted) post info
  protected getBaseUrl(): string {
    return window.location.origin;
  }

  protected getDisplayUrl(): string {
    return window.location.origin.replace('https://', '').replace('http://', '');
  }

  protected getQuotedPostForUrl(): Post | undefined {
    const post = this.data.post;
    if (
      post.post_type === 'quote' &&
      post.referenced_post?.post_type === 'quote' &&
      post.referenced_post.referenced_post
    ) {
      return post.referenced_post.referenced_post;
    }
    // Quoting a reposted quote post → show URL to the inner referenced post
    if (
      post.post_type === 'quote' &&
      post.referenced_post?.post_type === 'repost' &&
      post.referenced_post.referenced_post?.post_type === 'quote' &&
      post.referenced_post.referenced_post.referenced_post
    ) {
      return post.referenced_post.referenced_post.referenced_post;
    }
    return undefined;
  }

  // Schedule-related methods
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
    this.scheduledTime = null;
    this.showScheduleModal = false;
  }

  protected formatScheduledTime(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  }

  protected closeEmojiPickerBackdrop(): void {
    this.emojiPickerService.hidePicker();
  }

  // Hashtag autocomplete methods
  private checkForHashtagAutocomplete(): void {
    const textarea = this.replyTextarea?.nativeElement;
    if (!textarea) return;

    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = this.replyContent.substring(0, cursorPosition);
    
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
    const textarea = this.replyTextarea?.nativeElement;
    if (!textarea) return;

    const rect = textarea.getBoundingClientRect();
    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = this.replyContent.substring(0, cursorPosition);
    
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
    const textarea = this.replyTextarea?.nativeElement;
    if (!textarea) return;

    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = this.replyContent.substring(0, cursorPosition);
    
    // Find the hashtag to replace
    const hashtagMatch = textBeforeCursor.match(/#(\w*)$/);
    if (hashtagMatch) {
      const startPos = cursorPosition - hashtagMatch[0].length;
      const endPos = cursorPosition;
      
      // Replace the partial hashtag with the full one
      const newContent = this.replyContent.substring(0, startPos) + 
                        '#' + hashtag.name + 
                        this.replyContent.substring(endPos);
      
      this.replyContent = newContent;
      
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