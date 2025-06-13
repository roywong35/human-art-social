import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, Notification } from '../../../services/notification.service';
import { Subscription } from 'rxjs';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed top-4 right-4 z-50 flex flex-col gap-2">
      <div *ngFor="let notification of notifications"
           [@slideIn]
           class="notification-container min-w-[300px] p-4 rounded-lg shadow-lg text-white flex items-center justify-between"
           [ngClass]="{
             'bg-blue-500': notification.type === 'info',
             'bg-green-500': notification.type === 'success',
             'bg-red-500': notification.type === 'error'
           }">
        <div class="flex items-center gap-3">
          <i [class]="getIcon(notification.type)" class="text-lg"></i>
          <span class="text-sm font-medium">{{ notification.message }}</span>
        </div>
        <button (click)="removeNotification(notification.id)" class="text-white/80 hover:text-white">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .notification-container {
      animation: slide-in 0.3s ease-out;
      backdrop-filter: blur(8px);
      background-opacity: 0.95;
    }
    @keyframes slide-in {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `],
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'translateX(100%)', opacity: 0 }),
        animate('300ms ease-out', style({ transform: 'translateX(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ transform: 'translateX(100%)', opacity: 0 }))
      ])
    ])
  ]
})
export class NotificationComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  private subscription: Subscription | null = null;

  constructor(private notificationService: NotificationService) {}

  ngOnInit() {
    this.subscription = this.notificationService.notifications$.subscribe(notification => {
      this.notifications.push(notification);
      setTimeout(() => this.removeNotification(notification.id), 5000); // Remove after 5 seconds
    });
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  removeNotification(id: number) {
    this.notifications = this.notifications.filter(n => n.id !== id);
  }

  getIcon(type: 'success' | 'error' | 'info'): string {
    switch (type) {
      case 'success':
        return 'fas fa-check-circle';
      case 'error':
        return 'fas fa-exclamation-circle';
      case 'info':
        return 'fas fa-info-circle';
    }
  }
} 