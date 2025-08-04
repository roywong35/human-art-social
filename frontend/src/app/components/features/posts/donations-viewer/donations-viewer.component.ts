import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { DonationService } from '../../../../services/donation.service';
import { Donation } from '../../../../models/donation.model';
import { ToastService } from '../../../../services/toast.service';
import { TimeAgoPipe } from '../../../../pipes/time-ago.pipe';
import { GlobalModalService } from '../../../../services/global-modal.service';

@Component({
  selector: 'app-donations-viewer',
  standalone: true,
  imports: [CommonModule, MatDialogModule, TimeAgoPipe],
  templateUrl: './donations-viewer.component.html',
  styleUrls: ['./donations-viewer.component.scss']
})
export class DonationsViewerComponent implements OnInit, OnDestroy {
  donations: Donation[] = [];
  loading = true;
  error: string | null = null;
  
  // User preview modal timeouts
  private hoverTimeout: any;
  private leaveTimeout: any;
  private lastHoveredElement: Element | null = null;

  constructor(
    public dialogRef: MatDialogRef<DonationsViewerComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { post: any },
    private donationService: DonationService,
    private toastService: ToastService,
    private router: Router,
    private dialog: MatDialog,
    private globalModalService: GlobalModalService
  ) {}

  ngOnInit() {
    this.loadDonations();
  }

  ngOnDestroy() {
    // Clear any pending timeouts
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }
    if (this.leaveTimeout) {
      clearTimeout(this.leaveTimeout);
    }
    
    // Hide any open user preview modal
    this.globalModalService.hideUserPreview();
  }

  loadDonations() {
    this.loading = true;
    this.error = null;

    this.donationService.getPostDonations(this.data.post.id).subscribe({
      next: (donations) => {
        console.log('🎯 Donations received:', donations);
        console.log('🎯 First donation amount:', donations[0]?.amount, typeof donations[0]?.amount);
        this.donations = donations;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading donations:', error);
        this.error = 'Failed to load donations. Please try again later.';
        this.loading = false;
        this.toastService.showError('Failed to load donations');
      }
    });
  }

  close() {
    this.dialogRef.close();
  }

  getTotalDonations(): number {
    const total = this.donations.reduce((total, donation) => total + donation.amount, 0);
    console.log('🎯 Total donations calculated:', total, typeof total);
    return total;
  }

  formatAmount(amount: number): string {
    if (typeof amount !== 'number' || isNaN(amount)) {
      return '￥0';
    }
    return `￥${Math.floor(amount).toLocaleString()}`;
  }

  navigateToProfile(handle: string, event: Event): void {
    event.stopPropagation();
    this.dialogRef.close(); // Close the donations viewer modal
    this.router.navigate([`/${handle}`]);
  }

  onUserHover(event: MouseEvent, user: any): void {
    // Clear any pending timeouts
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }
    if (this.leaveTimeout) {
      clearTimeout(this.leaveTimeout);
    }

    this.hoverTimeout = setTimeout(() => {
      // Store the hovered element for accurate positioning
      this.lastHoveredElement = event.target as Element;
      
      console.log('🎯 Donations viewer: Preparing accurate modal for user', user.username);
      
      // Use the new accurate positioning method (no shifting!)
      this.globalModalService.showUserPreviewAccurate(user, this.lastHoveredElement);
    }, 300); // 300ms delay - faster than Twitter
  }

  onUserHoverLeave(): void {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }
    
    // Longer delay to allow moving to the modal
    this.leaveTimeout = setTimeout(() => {
      this.globalModalService.hideUserPreview();
    }, 300); // 300ms delay to allow moving to modal
  }

  onModalHover(): void {
    // When hovering over the modal, cancel any pending close
    if (this.leaveTimeout) {
      clearTimeout(this.leaveTimeout);
    }
    this.globalModalService.onModalHover();
  }

  getFormattedDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }
} 