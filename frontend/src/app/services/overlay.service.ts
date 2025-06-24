import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class OverlayService {
  private showOverlaySubject = new BehaviorSubject<boolean>(false);
  showOverlay$ = this.showOverlaySubject.asObservable();

  show() {
    this.showOverlaySubject.next(true);
  }

  hide() {
    this.showOverlaySubject.next(false);
  }
} 