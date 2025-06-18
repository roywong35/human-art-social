import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { User } from '../../../models/user.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-user-list-dialog',
  standalone: true,
  imports: [CommonModule, RouterModule, MatDialogModule],
  template: `
    <div class="p-6 min-w-[500px]">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold">{{ data.title }}</h2>
        <button (click)="dialogRef.close()" class="text-gray-500 hover:text-gray-700">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
        <div *ngFor="let user of data.users" 
             class="py-4 hover:bg-gray-50 transition-colors cursor-pointer"
             (click)="navigateToProfile(user.handle)">
          <div class="flex items-center px-4">
            <img [src]="user.profile_picture || defaultAvatar" 
                 [alt]="user.username + ' avatar'" 
                 class="w-12 h-12 rounded-full bg-gray-200">
            <div class="ml-3 flex-grow">
              <div class="font-bold text-gray-900">{{ user.username }}</div>
              <div class="text-gray-500">{{'@'}}{{ user.handle }}</div>
              <div class="text-gray-600 text-sm mt-1">{{ user.bio || 'No bio available' }}</div>
            </div>
          </div>
        </div>

        <div *ngIf="data.users.length === 0" class="py-8 text-center text-gray-500">
          No users to display
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class UserListDialogComponent {
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { 
      users: User[],
      title: string 
    },
    public dialogRef: MatDialogRef<UserListDialogComponent>,
    private router: Router
  ) {}

  navigateToProfile(handle: string): void {
    this.dialogRef.close();
    this.router.navigate(['/', handle]);
  }
} 