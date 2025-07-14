import { Component, ViewChild, ElementRef, OnDestroy, Inject, Optional, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { PostService } from '../../../../services/post.service';
import { AuthService } from '../../../../services/auth.service';
import { TimeAgoPipe } from '../../../../pipes/time-ago.pipe';
import { ImageUploadService, ImageFile } from '../../../../services/image-upload.service';
import { Subscription } from 'rxjs';
import { Post } from '../../../../models/post.model';
import { EmojiPickerService } from '../../../../services/emoji-picker.service';
import { PhotoViewerComponent } from '../../photo-viewer/photo-viewer.component';
import { environment } from '../../../../../environments/environment';
import { ScheduleIconComponent } from '../../../shared/schedule-icon/schedule-icon.component';
import { ScheduleModalComponent } from '../schedule-modal/schedule-modal.component';
import { DraftService, DraftPost } from '../../../../services/draft.service';
import { DraftModalComponent } from '../draft-modal/draft-modal.component';
import { SaveConfirmationDialogComponent } from '../../../dialogs/save-confirmation-dialog/save-confirmation-dialog.component';
import { ToastService } from '../../../../services/toast.service';

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
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';
  protected environment = environment;
  
  // Scheduled post properties
  protected scheduledTime: Date | null = null;
  protected showScheduleModal = false;

  protected images: ImageFile[] = [];
  private subscriptions: Subscription = new Subscription();
  protected quotePost: Post | undefined;

  constructor(
    public dialogRef: MatDialogRef<NewPostModalComponent>,
    private postService: PostService,
    private emojiPickerService: EmojiPickerService,
    public authService: AuthService,
    private imageUploadService: ImageUploadService,
    private dialog: MatDialog,
    private draftService: DraftService,
    private toastService: ToastService,
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
    // Component initialization
  }

  ngOnDestroy() {
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
      if (this.scheduledTime && this.scheduledTime > new Date()) {
        // Save as scheduled post instead of creating immediately
        const scheduledPostData = {
          content: this.content,
          images: this.images,
          scheduledTime: this.scheduledTime,
          quotePost: this.quotePost
        };

        const scheduledPostId = this.draftService.addScheduledPost(scheduledPostData);
        console.log('Post scheduled with ID:', scheduledPostId);
        
        this.dialogRef.close({ scheduled: true });
        return;
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
    // TODO: Navigate to scheduled posts view
    console.log('View scheduled posts');
    this.showScheduleModal = false;
  }

  protected clearSchedule(): void {
    this.scheduledTime = null;
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
      images: this.images,
      scheduledTime: this.scheduledTime,
      quotePost: this.quotePost
    };

    const draftId = this.draftService.saveDraft(draftData);
    console.log('Draft saved with ID:', draftId);
    
    // Show success toast
    this.toastService.showSuccess('Your post is saved');
    
    // Note: Draft modal opening is now handled by the caller based on context
  }

  private openDraftsModal(): void {
    const dialogRef = this.dialog.open(DraftModalComponent, {
      width: '600px',
      height: '600px',
      panelClass: 'draft-modal-dialog',
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
            images: result.scheduledPost.images,
            scheduledTime: result.scheduledPost.scheduledTime,
            quotePost: result.scheduledPost.quotePost,
            createdAt: result.scheduledPost.createdAt,
            updatedAt: new Date()
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
    this.scheduledTime = draft.scheduledTime ? new Date(draft.scheduledTime) : null;
    this.images = draft.images || [];
    this.quotePost = draft.quotePost;
  }
} 