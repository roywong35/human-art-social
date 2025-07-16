import { Component, OnInit, OnDestroy, Inject, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule, MatDialog, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DraftService, DraftPost, ScheduledPost } from '../../../../services/draft.service';
import { ScheduledPostService } from '../../../../services/scheduled-post.service';
import { TimeAgoPipe } from '../../../../pipes/time-ago.pipe';
import { Subscription } from 'rxjs';

interface DraftModalData {
  selectedTab?: string;
}

@Component({
  selector: 'app-draft-modal-2',
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

  // Edit mode functionality
  isEditMode = false;
  selectedDraftIds: Set<number> = new Set();
  selectedScheduledIds: Set<number> = new Set();

  constructor(
    private dialogRef: MatDialogRef<DraftModalComponent>,
    private draftService: DraftService,
    private dialog: MatDialog,
    private scheduledPostService: ScheduledPostService,
    @Optional() @Inject(MAT_DIALOG_DATA) private data?: DraftModalData
  ) {
    if (data?.selectedTab) {
      this.selectedTab = data.selectedTab;
    }
  }

  ngOnInit(): void {
    // Subscribe to drafts
    this.subscriptions.add(
      this.draftService.drafts$.subscribe(drafts => {
        console.log('Draft modal received drafts:', drafts);
        if (Array.isArray(drafts)) {
          this.drafts = drafts.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        } else {
          console.error('Draft modal received non-array drafts:', drafts);
          this.drafts = [];
        }
      })
    );

    // Subscribe to scheduled posts
    this.subscriptions.add(
      this.draftService.scheduledPosts$.subscribe(scheduledPosts => {
        console.log('Draft modal received scheduled posts:', scheduledPosts);
        if (Array.isArray(scheduledPosts)) {
          this.scheduledPosts = scheduledPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        } else {
          console.error('Draft modal received non-array scheduled posts:', scheduledPosts);
          this.scheduledPosts = [];
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  onBack(): void {
    this.dialogRef.close();
  }

  isUnsentTab(): boolean {
    return this.selectedTab === 'unsent';
  }

  isScheduledTab(): boolean {
    return this.selectedTab === 'scheduled';
  }

  onDraftEdit(draft: DraftPost): void {
    this.dialogRef.close({ action: 'edit', draft });
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



  getStatusBgColor(status: ScheduledPost['status']): string {
    switch (status) {
      case 'scheduled': return '#eff6ff';
      case 'sent': return '#f0f9ff';
      case 'failed': return '#fef2f2';
      default: return '#f9fafb';
    }
  }

  getStatusTextColor(status: ScheduledPost['status']): string {
    switch (status) {
      case 'scheduled': return '#2563eb';
      case 'sent': return '#059669';
      case 'failed': return '#dc2626';
      default: return '#6b7280';
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

  onRetryScheduledPost(scheduledPost: ScheduledPost): void {
    this.scheduledPostService.retryFailedPost(scheduledPost);
  }

  // Edit mode functionality
  toggleEditMode(): void {
    this.isEditMode = !this.isEditMode;
    if (!this.isEditMode) {
      this.selectedDraftIds.clear();
      this.selectedScheduledIds.clear();
    }
  }

  toggleDraftSelection(draftId: number): void {
    if (this.selectedDraftIds.has(draftId)) {
      this.selectedDraftIds.delete(draftId);
    } else {
      this.selectedDraftIds.add(draftId);
    }
  }

  toggleScheduledSelection(scheduledId: number): void {
    if (this.selectedScheduledIds.has(scheduledId)) {
      this.selectedScheduledIds.delete(scheduledId);
    } else {
      this.selectedScheduledIds.add(scheduledId);
    }
  }

  selectAllDrafts(): void {
    if (this.allDraftsSelected) {
      this.selectedDraftIds.clear();
    } else {
      this.drafts.forEach(draft => this.selectedDraftIds.add(draft.id));
    }
  }

  selectAllScheduled(): void {
    if (this.allScheduledSelected) {
      this.selectedScheduledIds.clear();
    } else {
      this.scheduledPosts.forEach(post => this.selectedScheduledIds.add(post.id));
    }
  }

  deleteSelectedDrafts(): void {
    this.selectedDraftIds.forEach(id => {
      this.draftService.deleteDraft(id).subscribe({
        next: () => {
          console.log(`Draft ${id} deleted successfully`);
        },
        error: (error) => {
          console.error(`Error deleting draft ${id}:`, error);
        }
      });
    });
    this.selectedDraftIds.clear();
  }

  deleteSelectedScheduled(): void {
    this.selectedScheduledIds.forEach(id => {
      this.draftService.deleteScheduledPost(id).subscribe({
        next: () => {
          console.log(`Scheduled post ${id} deleted successfully`);
        },
        error: (error) => {
          console.error(`Error deleting scheduled post ${id}:`, error);
        }
      });
    });
    this.selectedScheduledIds.clear();
  }

  deleteSelectedItems(): void {
    if (this.selectedTab === 'unsent') {
      this.deleteSelectedDrafts();
    } else {
      this.deleteSelectedScheduled();
    }
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
} 