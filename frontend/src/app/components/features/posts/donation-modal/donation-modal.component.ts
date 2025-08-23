import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DonationService } from '../../../../services/donation.service';
import { ToastService } from '../../../../services/toast.service';
import { Donation, CreateDonationRequest } from '../../../../models/donation.model';

@Component({
  selector: 'app-donation-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './donation-modal.component.html',
  styleUrls: ['./donation-modal.component.scss']
})
export class DonationModalComponent implements OnInit {
  predefinedAmounts = [100, 200, 500, 1000, 2000, 5000];
  selectedAmount = 100;
  customAmount: number | null = null;
  message = '';
  isPublic = true;
  donations: Donation[] = [];
  isSubmitting = false;
  isPWAMode = false;

  constructor(
    public dialogRef: MatDialogRef<DonationModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { post: any },
    private donationService: DonationService,
    private toastService: ToastService
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

  get canDonate(): boolean {
    return this.selectedAmount > 0 && !this.isSubmitting;
  }

  selectAmount(amount: number) {
    this.selectedAmount = amount;
    this.customAmount = null;
  }

  onCustomAmountChange(event: any) {
    const value = parseInt(event.target.value);
    if (value && value > 0) {
      this.selectedAmount = value;
      this.customAmount = value;
    }
  }

  togglePublic() {
    this.isPublic = !this.isPublic;
  }

  loadDonations() {
    this.donationService.getPostDonations(this.data.post.id).subscribe({
      next: (donations) => {
        this.donations = donations.filter(d => d.is_public);
      },
      error: (error) => {
        console.error('Error loading donations:', error);
      }
    });
  }

  calculateTotalRaised(): string {
    const total = this.donations.reduce((total, donation) => total + donation.amount, 0);
    return Math.floor(total).toLocaleString();
  }

  submitDonation() {
    if (!this.canDonate) return;

    this.isSubmitting = true;

    const donationRequest: CreateDonationRequest = {
      post: this.data.post.id,
      amount: this.selectedAmount,
      message: this.message.trim() || undefined,
      is_public: this.isPublic
    };

    this.donationService.createDonation(donationRequest).subscribe({
      next: (donation) => {
        this.toastService.showSuccess(`Successfully donated ￥${donation.amount} to ${this.data.post.author.username}!`);
        this.dialogRef.close(donation);
      },
      error: (error) => {
        console.error('Error creating donation:', error);
        this.toastService.showError('Failed to process donation. Please try again.');
        this.isSubmitting = false;
      }
    });
  }

  close() {
    this.dialogRef.close();
  }
}