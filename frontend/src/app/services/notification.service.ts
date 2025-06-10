import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Notification {
  message: string;
  type: 'success' | 'error';
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationSubject = new BehaviorSubject<Notification | null>(null);
  public notification$ = this.notificationSubject.asObservable();

  showSuccess(message: string) {
    this.notificationSubject.next({ message, type: 'success' });
    setTimeout(() => this.notificationSubject.next(null), 3000); // Hide after 3 seconds
  }

  showError(message: string) {
    this.notificationSubject.next({ message, type: 'error' });
    setTimeout(() => this.notificationSubject.next(null), 3000); // Hide after 3 seconds
  }

  clear() {
    this.notificationSubject.next(null);
  }
} 