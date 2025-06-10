import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface EmojiPickerPosition {
  top: number;
  left: number;
}

@Injectable({
  providedIn: 'root'
})
export class EmojiPickerService {
  private showPickerSubject = new BehaviorSubject<boolean>(false);
  private positionSubject = new BehaviorSubject<EmojiPickerPosition>({ top: 0, left: 0 });

  showPicker$ = this.showPickerSubject.asObservable();
  position$ = this.positionSubject.asObservable();

  calculatePosition(buttonElement: HTMLElement): EmojiPickerPosition {
    const rect = buttonElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const pickerHeight = 435; // Standard height of emoji picker
    
    // Calculate position relative to viewport
    const spaceBelow = viewportHeight - rect.bottom;
    
    // Position above if not enough space below
    const top = spaceBelow < pickerHeight && rect.top > pickerHeight
      ? rect.top - pickerHeight - 5
      : rect.bottom + 5;

    const left = Math.max(10, rect.left - 320 + rect.width);

    return { top, left };
  }

  show(buttonElement: HTMLElement): void {
    const position = this.calculatePosition(buttonElement);
    this.positionSubject.next(position);
    this.showPickerSubject.next(true);
  }

  hide(): void {
    this.showPickerSubject.next(false);
  }

  toggle(buttonElement: HTMLElement): void {
    if (this.showPickerSubject.value) {
      this.hide();
    } else {
      this.show(buttonElement);
    }
  }
} 