import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class HomeRefreshService {
  // Subject to trigger home component refresh
  private refreshHomeSubject = new Subject<void>();
  
  // Observable that home component can subscribe to
  refreshHome$ = this.refreshHomeSubject.asObservable();

  /**
   * Trigger home component refresh
   * This will show the "new posts" button if there are new posts
   */
  triggerHomeRefresh(): void {
    this.refreshHomeSubject.next();
  }
}
