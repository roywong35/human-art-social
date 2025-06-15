import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface EmojiPickerState {
  show: boolean;
  position: {
    top: number;
    left: number;
  };
  targetElement?: HTMLElement;
}

@Injectable({
  providedIn: 'root'
})
export class EmojiPickerService {
  private pickerSubject = new BehaviorSubject<EmojiPickerState>({
    show: false,
    position: { top: 0, left: 0 }
  });

  pickerState$ = this.pickerSubject.asObservable();

  showPicker(event: MouseEvent, targetElement?: HTMLElement) {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceRight = viewportWidth - rect.left;
    const pickerHeight = 435; // Height of the emoji picker
    const pickerWidth = 320; // Width of the emoji picker
    
    // Calculate vertical position
    let top;
    if (spaceBelow < pickerHeight && rect.top > pickerHeight) {
      // Position above if not enough space below
      top = rect.top - pickerHeight - 5;
    } else {
      // Position below
      top = rect.bottom + 5;
    }

    // Calculate horizontal position
    let left;
    if (spaceRight < pickerWidth) {
      // Position from right edge if not enough space on right
      left = rect.right - pickerWidth;
    } else {
      // Position from left edge
      left = rect.left;
    }

    this.pickerSubject.next({
      show: true,
      position: {
        top: top,
        left: left
      },
      targetElement
    });
  }

  hidePicker() {
    this.pickerSubject.next({
      show: false,
      position: { top: 0, left: 0 }
    });
  }

  onEmojiSelect(emoji: any, callback: (emoji: any) => void) {
    callback(emoji);
    this.hidePicker();
  }
} 