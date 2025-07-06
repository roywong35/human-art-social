import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface EmojiPickerState {
  show: boolean;
  position: {
    top: number;
    left: number;
  };
  targetElement?: HTMLElement;
  callback?: (emoji: any) => void;
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

  showPicker(event: MouseEvent, targetElement?: HTMLElement, callback?: (emoji: any) => void) {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;
    const pickerHeight = 350; // Height of the emoji picker
    const pickerWidth = 320; // Width of the emoji picker
    const gap = 8; // Gap between picker and button
    
    // Calculate vertical position - prefer above the button
    let top;
    const shouldPositionAbove = spaceAbove >= pickerHeight + gap + 10; // Ensure enough space above
    
    if (shouldPositionAbove) {
      // Position above the button with gap
      top = rect.top - pickerHeight - gap;
    } else if (spaceBelow >= pickerHeight + gap + 10) {
      // Position below the button with gap
      top = rect.bottom + gap;
    } else {
      // Not enough space above or below, position wherever fits better
      if (spaceAbove > spaceBelow) {
        // More space above, position at top of viewport with margin
        top = 10;
      } else {
        // More space below, position as low as possible
        top = viewportHeight - pickerHeight - 10;
      }
    }

    // Calculate horizontal position - center the picker relative to the button
    const buttonCenter = rect.left + (rect.width / 2);
    const pickerLeftForCentering = buttonCenter - (pickerWidth / 2);
    
    let left;
    if (pickerLeftForCentering < 10) {
      // If centering would push picker off left edge, position from left edge
      left = 10;
    } else if (pickerLeftForCentering + pickerWidth > viewportWidth - 10) {
      // If centering would push picker off right edge, position from right edge
      left = viewportWidth - pickerWidth - 10;
    } else {
      // Center the picker relative to the button
      left = pickerLeftForCentering;
    }
    


    this.pickerSubject.next({
      show: true,
      position: {
        top: top,
        left: left + 5
      },
      targetElement,
      callback
    });
  }

  hidePicker() {
    console.log('Hiding picker');
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