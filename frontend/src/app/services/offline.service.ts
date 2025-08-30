import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class OfflineService {
  private isOfflineSubject = new BehaviorSubject<boolean>(false);
  public isOffline$ = this.isOfflineSubject.asObservable();

  constructor() {
    this.setupOfflineDetection();
  }

  private setupOfflineDetection() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOfflineSubject.next(false);
    });

    window.addEventListener('offline', () => {
      this.isOfflineSubject.next(true);
    });

    // Initial check
    this.isOfflineSubject.next(!navigator.onLine);
  }

  get isOffline(): boolean {
    return this.isOfflineSubject.value;
  }

  /**
   * Check if the app is currently offline
   */
  checkOfflineStatus(): boolean {
    return !navigator.onLine;
  }

  /**
   * Manually trigger offline status check
   */
  refreshOfflineStatus(): void {
    this.isOfflineSubject.next(!navigator.onLine);
  }
}
