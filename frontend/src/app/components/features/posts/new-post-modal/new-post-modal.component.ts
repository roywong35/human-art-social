import { Component, ViewChild, ElementRef, OnDestroy, Inject, Optional, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { PostService } from '../../../../services/post.service';
import { AuthService } from '../../../../services/auth.service';
import { TimeAgoPipe } from '../../../../pipes/time-ago.pipe';
import { ImageUploadService, ImageFile } from '../../../../services/image-upload.service';
import { ImageCompressionService } from '../../../../services/image-compression.service';
import { Subscription } from 'rxjs';
import { Post } from '../../../../models/post.model';
import { EmojiPickerService } from '../../../../services/emoji-picker.service';
import { PhotoViewerComponent } from '../../photo-viewer/photo-viewer.component';
import { environment } from '../../../../../environments/environment';
import { ScheduleIconComponent } from '../../../shared/schedule-icon/schedule-icon.component';
import { ScheduleModalComponent } from '../../../shared/schedule-modal/schedule-modal.component';
import { DraftService, DraftPost } from '../../../../services/draft.service';
import { DraftModalComponent } from '../draft-modal/draft-modal.component';
import { SaveConfirmationDialogComponent } from '../../../dialogs/save-confirmation-dialog/save-confirmation-dialog.component';
import { ToastService } from '../../../../services/toast.service';
import { HashtagService, HashtagResult } from '../../../../services/hashtag.service';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

interface DialogData {
  quotePost?: Post;
  draft?: DraftPost;
}

@Component({
  selector: 'app-new-post-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    TimeAgoPipe,
    ScheduleIconComponent,
    ScheduleModalComponent
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
  protected emojiPickerOpen = false;
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';
  protected environment = environment;
  
  // Scheduled post properties
  protected scheduledTime: Date | null = null;
  protected showScheduleModal = false;

  protected images: ImageFile[] = [];
  private subscriptions: Subscription = new Subscription();
  protected quotePost: Post | undefined;

  // Hashtag autocomplete properties
  protected hashtagSuggestions: HashtagResult[] = [];
  protected showHashtagDropdown = false;
  protected selectedHashtagIndex = 0;
  protected currentHashtagQuery = '';
  protected hashtagDropdownPosition = { top: 0, left: 0 };
  private hashtagSubscription?: Subscription;

  isPWAMode = false;

  constructor(
    public dialogRef: MatDialogRef<NewPostModalComponent>,
    private postService: PostService,
    private emojiPickerService: EmojiPickerService,
    public authService: AuthService,
    private imageUploadService: ImageUploadService,
    private imageCompressionService: ImageCompressionService,
    private dialog: MatDialog,
    private draftService: DraftService,
    private toastService: ToastService,
    private hashtagService: HashtagService,
    @Optional() @Inject(MAT_DIALOG_DATA) private data?: DialogData
  ) {
    this.quotePost = data?.quotePost;

    // If we're editing a draft, populate the form
    if (data && 'draft' in data) {
      this.loadDraftData(data.draft as DraftPost);
    }

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
    // Check if running as PWA
    this.isPWAMode = window.matchMedia('(display-mode: standalone)').matches;
    
    // Listen for PWA mode changes
    window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
      this.isPWAMode = e.matches;
    });
    
    // Component initialization
    
    // Subscribe to emoji picker state
    this.subscriptions.add(
      this.emojiPickerService.pickerState$.subscribe(state => {
        this.emojiPickerOpen = state.show;
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    this.imageUploadService.clearImages();
    
    if (this.hashtagSubscription) {
      this.hashtagSubscription.unsubscribe();
    }
  }

  protected getBaseUrl(): string {
    return window.location.origin;
  }

  protected getDisplayUrl(): string {
    return window.location.origin.replace('https://', '').replace('http://', '');
  }

  protected getQuotedPostImages(): any[] {
    if (!this.quotePost) {
      return [];
    }
    
    // If this is a repost, get images from the referenced post
    if (this.quotePost.post_type === 'repost' && this.quotePost.referenced_post) {
      return this.quotePost.referenced_post.images || [];
    }
    
    // Otherwise, use the quote post's own images
    return this.quotePost.images || [];
  }

  protected getQuotedPostForUrl(): Post | undefined {
    if (!this.quotePost) {
      return undefined;
    }
    
    // For quote posts, show URL to the referenced post
    if (this.quotePost.post_type === 'quote' && this.quotePost.referenced_post) {
      return this.quotePost.referenced_post;
    }
    
    // For reposts of quote posts, show URL to the referenced post of the quote post that was reposted
    if (this.quotePost.post_type === 'repost' && this.quotePost.referenced_post?.post_type === 'quote' && this.quotePost.referenced_post.referenced_post) {
      return this.quotePost.referenced_post.referenced_post;
    }
    
    // For regular posts, don't show URL
    return undefined;
  }

  protected async createPost() {
    if (this.isSubmitting) return;
    this.isSubmitting = true;
    this.error = null;

    try {
      if (this.scheduledTime && this.scheduledTime > new Date()) {
        // Save as scheduled post instead of creating immediately
        const scheduledPostData = {
          content: this.content,
          scheduled_time: this.scheduledTime.toISOString(),
          quote_post: this.quotePost?.id,
          is_human_drawing: false
        };

        const imageFiles = this.images.map(img => img.file).filter(file => file instanceof File) as File[];

        try {
          const savedScheduledPost = await this.draftService.addScheduledPost(scheduledPostData, imageFiles).toPromise();
          
          this.toastService.showSuccess('Post scheduled successfully');
          this.dialogRef.close({ scheduled: true });
          return;
        } catch (error) {
          console.error('Error scheduling post:', error);
          this.error = 'Failed to schedule post. Please try again.';
          this.isSubmitting = false;
          return;
        }
      }

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
          this.images.map(img => img.file),
          undefined // No scheduled time for immediate posts
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
    // Check if there's content (text or images) before closing
    if (this.content.trim() || this.images.length > 0) {
      this.showSaveDiscardDialog('close');
    } else {
      this.dialogRef.close();
    }
  }

  async onImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      // Compress images before adding to service
      const files = Array.from(input.files);
      const compressedFiles = await this.imageCompressionService.compressImages(files, 'POST');
      
      // Create FileList from compressed files
      const compressedFileList = new DataTransfer();
      compressedFiles.forEach(file => compressedFileList.items.add(file));
      
      await this.imageUploadService.addImages(compressedFileList.files);
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
    
    // Check for hashtag autocomplete
    this.checkForHashtagAutocomplete();
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

  // Scheduling Methods
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
    
    // Open draft modal with scheduled tab selected
    const dialogRef = this.dialog.open(DraftModalComponent, {
      width: '600px',
      height: '600px',
      panelClass: 'clean-draft-modal',
      maxWidth: '90vw',
      maxHeight: '90vh',
      data: { selectedTab: 'scheduled' } // Pass the tab to select
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.action === 'edit') {
        if (result.draft) {
          // Close current modal and open new one with draft data
          this.dialogRef.close();
          this.dialog.open(NewPostModalComponent, {
            panelClass: ['create-post-dialog'],
            maxWidth: '100vw',
            maxHeight: '100vh',
            width: '100vw',
            height: '100vh',
            disableClose: false,
            hasBackdrop: true,
            data: { draft: result.draft }
          });
        } else if (result.scheduledPost) {
          // Convert scheduled post to draft format and edit
          const draftData: DraftPost = {
            id: result.scheduledPost.id,
            content: result.scheduledPost.content,
            author: result.scheduledPost.author,
            scheduled_time: result.scheduledPost.scheduled_time,
            quote_post: result.scheduledPost.quote_post,
            created_at: result.scheduledPost.created_at,
            updated_at: result.scheduledPost.updated_at,
            post_type: result.scheduledPost.post_type,
            parent_post: result.scheduledPost.parent_post,
            is_human_drawing: result.scheduledPost.is_human_drawing,
            images: result.scheduledPost.images
          };
          
          // Close current modal and open new one with scheduled post data
          this.dialogRef.close();
          this.dialog.open(NewPostModalComponent, {
            panelClass: ['create-post-dialog'],
            maxWidth: '100vw',
            maxHeight: '100vh',
            width: '100vw',
            height: '100vh',
            disableClose: false,
            hasBackdrop: true,
            data: { draft: draftData }
          });
        }
      }
    });
  }

  protected clearSchedule(): void {
    this.scheduledTime = null;
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

  // Drafts Methods
  protected onDraftsClick(): void {
    const hasContent = this.content.trim().length > 0 || this.images.length > 0;
    
    if (hasContent) {
      // Show save/discard confirmation dialog
      this.showSaveDiscardDialog('drafts');
    } else {
      // Open drafts modal
      this.openDraftsModal();
    }
  }

  private showSaveDiscardDialog(source: 'close' | 'drafts'): void {
    const dialogRef = this.dialog.open(SaveConfirmationDialogComponent, {
      width: '320px',
      panelClass: 'save-confirmation-dialog',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.action === 'save') {
        this.saveDraft();
        if (source === 'drafts') {
          // Coming from drafts button - open draft modal
          this.openDraftsModal();
        } else {
          // Coming from close button - just close the modal
          this.dialogRef.close();
        }
      } else if (result?.action === 'discard') {
        if (source === 'drafts') {
          // Coming from drafts button - open draft modal
          this.openDraftsModal();
        } else {
          // Coming from close button - just close the modal
          this.dialogRef.close();
        }
      }
      // If 'cancel' or no action, do nothing (stay in current modal)
    });
  }

  private saveDraft(): void {
    const draftData = {
      content: this.content,
      scheduled_time: this.scheduledTime?.toISOString() || null,
      quote_post: this.quotePost?.id,
      is_human_drawing: false
    };

    const imageFiles = this.images.map(img => img.file).filter(file => file instanceof File) as File[];

    this.draftService.saveDraft(draftData, imageFiles).subscribe({
      next: (savedDraft) => {
        this.toastService.showSuccess('Your post is saved');
      },
      error: (error) => {
        console.error('Error saving draft:', error);
        this.toastService.showError('Failed to save draft');
      }
    });
  }

  private openDraftsModal(): void {
    const dialogRef = this.dialog.open(DraftModalComponent, {
      width: '600px',
      height: '600px',
      panelClass: 'clean-draft-modal',
      maxWidth: '90vw',
      maxHeight: '90vh'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.action === 'edit') {
        if (result.draft) {
          // Close current modal and open new one with draft data
          this.dialogRef.close();
          this.dialog.open(NewPostModalComponent, {
            panelClass: ['create-post-dialog'],
            maxWidth: '100vw',
            maxHeight: '100vh',
            width: '100vw',
            height: '100vh',
            disableClose: false,
            hasBackdrop: true,
            data: { draft: result.draft }
          });
        } else if (result.scheduledPost) {
          // Convert scheduled post to draft format and edit
          const draftData: DraftPost = {
            id: result.scheduledPost.id,
            content: result.scheduledPost.content,
            author: result.scheduledPost.author,
            scheduled_time: result.scheduledPost.scheduled_time,
            quote_post: result.scheduledPost.quote_post,
            created_at: result.scheduledPost.created_at,
            updated_at: result.scheduledPost.updated_at,
            post_type: result.scheduledPost.post_type,
            parent_post: result.scheduledPost.parent_post,
            is_human_drawing: result.scheduledPost.is_human_drawing,
            images: result.scheduledPost.images
          };
          
          // Close current modal and open new one with scheduled post data
          this.dialogRef.close();
          this.dialog.open(NewPostModalComponent, {
            panelClass: ['create-post-dialog'],
            maxWidth: '100vw',
            maxHeight: '100vh',
            width: '100vw',
            height: '100vh',
            disableClose: false,
            hasBackdrop: true,
            data: { draft: draftData }
          });
        }
      }
    });
  }

  private loadDraftData(draft: DraftPost): void {
    this.content = draft.content;
    this.scheduledTime = draft.scheduled_time ? new Date(draft.scheduled_time) : null;
    // Note: We can't directly load images from the backend response to ImageFile[]
    // This would need to be handled by downloading the images and creating File objects
    // For now, we'll leave images empty when editing drafts
    this.images = [];
    this.quotePost = draft.quote_post;
  }

  protected closeEmojiPickerBackdrop(): void {
    this.emojiPickerService.hidePicker();
  }

  // Hashtag autocomplete methods
  private checkForHashtagAutocomplete(): void {
    const textarea = this.postTextarea?.nativeElement;
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
    const textarea = this.postTextarea?.nativeElement;
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
    const textarea = this.postTextarea?.nativeElement;
    if (!textarea) return;

    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = this.content.substring(0, cursorPosition);
    
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