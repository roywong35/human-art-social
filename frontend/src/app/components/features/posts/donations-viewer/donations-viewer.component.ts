import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { DonationService } from '../../../../services/donation.service';
import { Donation } from '../../../../models/donation.model';
import { ToastService } from '../../../../services/toast.service';
import { TimeAgoPipe } from '../../../../pipes/time-ago.pipe';
import { GlobalModalService } from '../../../../services/global-modal.service';
import { UserService } from '../../../../services/user.service';
import { take } from 'rxjs/operators';

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
  isPWAMode = false;
  
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
    private globalModalService: GlobalModalService,
    private userService: UserService
  ) {}

  ngOnInit() {
    // Check if running as PWA
    this.isPWAMode = window.matchMedia('(display-mode: standalone)').matches;
    
    // Listen for PWA mode changes
    window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
      this.isPWAMode = e.matches;
    });
    
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
      
      // X approach: Pre-fetch full user data before showing modal
      // This ensures counts and follow button state are ready immediately
      this.userService.getUserByHandle(user.handle).pipe(take(1)).subscribe({
        next: (fullUser) => {
          // Show modal with complete data - no more delayed counts!
          if (this.lastHoveredElement) {
            this.globalModalService.showUserPreviewAccurate(fullUser, this.lastHoveredElement, {
              clearLeaveTimeout: () => {
                if (this.leaveTimeout) {
                  clearTimeout(this.leaveTimeout);
                }
              }
            });
          }
        },
        error: () => {
          // Fallback: show lightweight preview if fetch fails
          if (this.lastHoveredElement) {
            this.globalModalService.showUserPreviewAccurate(user, this.lastHoveredElement, {
              clearLeaveTimeout: () => {
                if (this.leaveTimeout) {
                  clearTimeout(this.leaveTimeout);
                }
              }
            });
          }
        }
      });
    }, 200); // Reduced to 200ms for X-like responsiveness
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