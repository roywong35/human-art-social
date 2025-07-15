import { Component, OnInit, OnDestroy, Inject, Optional, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule, MatDialog, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DraftService, DraftPost, ScheduledPost } from '../../../../services/draft.service';
import { ScheduledPostService } from '../../../../services/scheduled-post.service';
import { TimeAgoPipe } from '../../../../pipes/time-ago.pipe';
import { Subscription } from 'rxjs';
import { DeleteConfirmationDialogComponent, DeleteConfirmationData } from '../../../dialogs/delete-confirmation-dialog/delete-confirmation-dialog.component';
import { DraftModal2Component } from '../draft-modal-2/draft-modal-2.component';

interface DraftModalData {
  selectedTab?: 'unsent' | 'scheduled';
}

@Component({
  selector: 'app-draft-modal',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    TimeAgoPipe
  ],
  templateUrl: './draft-modal.component.html',
  styleUrls: ['./draft-modal.component.scss']
})
export class DraftModalComponent implements OnInit, OnDestroy {
  drafts: DraftPost[] = [];
  scheduledPosts: ScheduledPost[] = [];
  selectedTab = 'unsent';
  private subscriptions = new Subscription();

  // Edit mode state
  isEditMode = false;
  selectedDraftIds: Set<string> = new Set();
  selectedScheduledIds: Set<string> = new Set();
  
  // Test property
  testMode = true;
  
  isUnsentTab(): boolean {
    return this.selectedTab === 'unsent';
  }

  isScheduledTab(): boolean {
    return this.selectedTab === 'scheduled';
  }

  constructor(
    private dialogRef: MatDialogRef<DraftModalComponent>,
    private draftService: DraftService,
    private dialog: MatDialog,
    private scheduledPostService: ScheduledPostService,
    private cdr: ChangeDetectorRef,
    @Optional() @Inject(MAT_DIALOG_DATA) private data?: DraftModalData
  ) {
    // Set initial tab from data if provided
    if (data?.selectedTab) {
      this.selectedTab = data.selectedTab;
    }
  }

  ngOnInit(): void {
    // Subscribe to drafts
    this.subscriptions.add(
      this.draftService.drafts$.subscribe(drafts => {
        this.drafts = drafts.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      })
    );

    // Subscribe to scheduled posts
    this.subscriptions.add(
      this.draftService.scheduledPosts$.subscribe(scheduledPosts => {
        console.log('Draft modal received scheduled posts:', scheduledPosts);
        this.scheduledPosts = scheduledPosts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        console.log('Sorted scheduled posts:', this.scheduledPosts);
      })
    );

    // Debug: Check localStorage directly
    const storedScheduledPosts = localStorage.getItem('scheduled_posts');
    console.log('Scheduled posts in localStorage:', storedScheduledPosts);
    console.log('Initial selected tab:', this.selectedTab);
    console.log('Data passed to modal:', this.data);
  }

  // Debug method - can be called from browser console
  public debugScheduledPosts(): void {
    console.log('=== SCHEDULED POSTS DEBUG ===');
    console.log('Current scheduledPosts array:', this.scheduledPosts);
    console.log('scheduledPosts.length:', this.scheduledPosts.length);
    console.log('localStorage scheduled_posts:', localStorage.getItem('scheduled_posts'));
    console.log('DraftService scheduled posts:', this.draftService.getScheduledPosts());
    console.log('Current selected tab:', this.selectedTab);
    console.log('isScheduledTab getter:', this.isScheduledTab);
    
    // Debug each scheduled post individually
    this.scheduledPosts.forEach((post, index) => {
      console.log(`--- Scheduled Post ${index} ---`);
      console.log('Full object:', post);
      console.log('ID:', post.id);
      console.log('Content:', post.content);
      console.log('Status:', post.status);
      console.log('ScheduledTime:', post.scheduledTime);
      console.log('Images:', post.images);
      console.log('QuotePost:', post.quotePost);
      console.log('CreatedAt:', post.createdAt);
    });
    
    // Debug template conditions
    console.log('Template conditions:');
    console.log('isScheduledTab:', this.isScheduledTab());
    console.log('scheduledPosts.length === 0:', this.scheduledPosts.length === 0);
    console.log('Should show empty message:', this.isScheduledTab() && this.scheduledPosts.length === 0);
    console.log('Should show posts:', this.isScheduledTab() && this.scheduledPosts.length > 0);
  }

  // Debug method to clear all localStorage
  public clearAllData(): void {
    localStorage.removeItem('scheduled_posts');
    localStorage.removeItem('post_drafts');
    console.log('All draft and scheduled post data cleared');
    location.reload();
  }

  public openNewModal(): void {
    const dialogRef = this.dialog.open(DraftModal2Component, {
      width: '600px',
      height: '600px',
      panelClass: 'clean-draft-modal',  // Use new clean panel class
      maxWidth: '90vw',
      maxHeight: '90vh',
      data: { selectedTab: this.selectedTab }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.action === 'edit') {
        this.dialogRef.close(result);
      }
    });
  }

  showScheduledTab(): boolean {
    console.log('showScheduledTab called. selectedTab:', this.selectedTab);
    const result = this.selectedTab === 'scheduled';
    console.log('showScheduledTab result:', result);
    if (result) {
      this.cdr.detectChanges();
    }
    return result;
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  onBack(): void {
    this.dialogRef.close();
  }

  toggleEditMode(): void {
    this.isEditMode = !this.isEditMode;
    if (!this.isEditMode) {
      this.selectedDraftIds.clear();
      this.selectedScheduledIds.clear();
    }
  }

  onDraftEdit(draft: DraftPost): void {
    // Close this modal and return the draft data to be edited
    this.dialogRef.close({ action: 'edit', draft });
  }

  onDraftDelete(draft: DraftPost): void {
    const dialogRef = this.dialog.open(DeleteConfirmationDialogComponent, {
      width: '400px',
      panelClass: 'delete-confirmation-dialog',
      data: {
        title: 'Delete draft?',
        message: 'This action cannot be undone. Your draft will be permanently removed.'
      } as DeleteConfirmationData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.draftService.deleteDraft(draft.id);
      }
    });
  }

  onScheduledPostEdit(scheduledPost: ScheduledPost): void {
    // Close this modal and return the scheduled post data to be edited
    this.dialogRef.close({ action: 'edit', scheduledPost });
  }

  onScheduledPostDelete(scheduledPost: ScheduledPost): void {
    const dialogRef = this.dialog.open(DeleteConfirmationDialogComponent, {
      width: '400px',
      panelClass: 'delete-confirmation-dialog',
      data: {
        title: 'Delete scheduled post?',
        message: 'This action cannot be undone. Your scheduled post will be permanently removed.'
      } as DeleteConfirmationData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.draftService.deleteScheduledPost(scheduledPost.id);
      }
    });
  }

  onScheduledPostCancel(scheduledPost: ScheduledPost): void {
    const dialogRef = this.dialog.open(DeleteConfirmationDialogComponent, {
      width: '400px',
      panelClass: 'delete-confirmation-dialog',
      data: {
        title: 'Cancel scheduled post?',
        message: 'This will permanently remove your scheduled post and it will not be published.'
      } as DeleteConfirmationData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.draftService.deleteScheduledPost(scheduledPost.id);
      }
    });
  }

  onRetryScheduledPost(scheduledPost: ScheduledPost): void {
    this.scheduledPostService.retryFailedPost(scheduledPost);
  }

  // Edit mode methods
  toggleDraftSelection(draftId: string): void {
    if (this.selectedDraftIds.has(draftId)) {
      this.selectedDraftIds.delete(draftId);
    } else {
      this.selectedDraftIds.add(draftId);
    }
  }

  toggleScheduledSelection(scheduledId: string): void {
    if (this.selectedScheduledIds.has(scheduledId)) {
      this.selectedScheduledIds.delete(scheduledId);
    } else {
      this.selectedScheduledIds.add(scheduledId);
    }
  }

  selectAllDrafts(): void {
    if (this.selectedDraftIds.size === this.drafts.length) {
      this.selectedDraftIds.clear();
    } else {
      this.selectedDraftIds.clear();
      this.drafts.forEach(draft => this.selectedDraftIds.add(draft.id));
    }
  }

  selectAllScheduled(): void {
    if (this.selectedScheduledIds.size === this.scheduledPosts.length) {
      this.selectedScheduledIds.clear();
    } else {
      this.selectedScheduledIds.clear();
      this.scheduledPosts.forEach(post => this.selectedScheduledIds.add(post.id));
    }
  }

  deleteSelectedDrafts(): void {
    const count = this.selectedDraftIds.size;
    if (count === 0) return;

    const title = count === 1 ? 'Delete draft?' : `Delete ${count} drafts?`;
    const message = count === 1 ? 
      'This action cannot be undone. Your draft will be permanently removed.' :
      `This action cannot be undone. All ${count} selected drafts will be permanently removed.`;

    const dialogRef = this.dialog.open(DeleteConfirmationDialogComponent, {
      width: '400px',
      panelClass: 'delete-confirmation-dialog',
      data: {
        title,
        message
      } as DeleteConfirmationData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.selectedDraftIds.forEach(id => {
          this.draftService.deleteDraft(id);
        });
        this.selectedDraftIds.clear();
      }
    });
  }

  deleteSelectedScheduled(): void {
    const count = this.selectedScheduledIds.size;
    if (count === 0) return;

    const title = count === 1 ? 'Delete scheduled post?' : `Delete ${count} scheduled posts?`;
    const message = count === 1 ? 
      'This action cannot be undone. Your scheduled post will be permanently removed.' :
      `This action cannot be undone. All ${count} selected scheduled posts will be permanently removed.`;

    const dialogRef = this.dialog.open(DeleteConfirmationDialogComponent, {
      width: '400px',
      panelClass: 'delete-confirmation-dialog',
      data: {
        title,
        message
      } as DeleteConfirmationData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.selectedScheduledIds.forEach(id => {
          this.draftService.deleteScheduledPost(id);
        });
        this.selectedScheduledIds.clear();
      }
    });
  }

  get hasSelectedDrafts(): boolean {
    return this.selectedDraftIds.size > 0;
  }

  get hasSelectedScheduled(): boolean {
    return this.selectedScheduledIds.size > 0;
  }

  get hasSelectedItems(): boolean {
    return this.selectedTab === 'unsent' ? this.hasSelectedDrafts : this.hasSelectedScheduled;
  }



  get allDraftsSelected(): boolean {
    return this.drafts.length > 0 && this.selectedDraftIds.size === this.drafts.length;
  }

  get allScheduledSelected(): boolean {
    return this.scheduledPosts.length > 0 && this.selectedScheduledIds.size === this.scheduledPosts.length;
  }

  deleteSelectedItems(): void {
    if (this.selectedTab === 'unsent') {
      this.deleteSelectedDrafts();
    } else {
      this.deleteSelectedScheduled();
    }
  }

  getPreviewText(content: string): string {
    return content.length > 100 ? content.substring(0, 100) + '...' : content;
  }

  formatScheduledTime(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  }

  getStatusColor(status: ScheduledPost['status']): string {
    switch (status) {
      case 'scheduled': return 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20';
      case 'sent': return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20';
      case 'failed': return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20';
      default: return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-800';
    }
  }

  getStatusText(status: ScheduledPost['status']): string {
    switch (status) {
      case 'scheduled': return 'Scheduled';
      case 'sent': return 'Sent';
      case 'failed': return 'Failed';
      default: return 'Unknown';
    }
  }
} 