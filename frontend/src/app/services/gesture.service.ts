import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface SwipeEvent {
  direction: 'left' | 'right' | 'up' | 'down';
  distance: number;
  velocity: number;
}

export interface LongPressEvent {
  duration: number;
  position: { x: number; y: number };
}

@Injectable({
  providedIn: 'root'
})
export class GestureService {
  private swipeSubject = new Subject<SwipeEvent>();
  private longPressSubject = new Subject<LongPressEvent>();
  
  public swipe$ = this.swipeSubject.asObservable();
  public longPress$ = this.longPressSubject.asObservable();
  
  private touchStartTime = 0;
  private touchStartPosition = { x: 0, y: 0 };
  private touchEndPosition = { x: 0, y: 0 };
  private longPressTimer: any;
  private isLongPress = false;
  
  private readonly SWIPE_THRESHOLD = 50;
  private readonly LONG_PRESS_DURATION = 500;
  
  constructor() {}
  
  /**
   * Initialize gesture detection for an element
   */
  initGestures(element: HTMLElement): void {
    element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    element.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    element.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
  }
  
  /**
   * Remove gesture detection from an element
   */
  removeGestures(element: HTMLElement): void {
    element.removeEventListener('touchstart', this.handleTouchStart.bind(this));
    element.removeEventListener('touchmove', this.handleTouchMove.bind(this));
    element.removeEventListener('touchend', this.handleTouchEnd.bind(this));
  }
  
  private handleTouchStart(event: TouchEvent): void {
    const touch = event.touches[0];
    this.touchStartTime = Date.now();
    this.touchStartPosition = { x: touch.clientX, y: touch.clientY };
    this.isLongPress = false;
    
    // Start long press timer
    this.longPressTimer = setTimeout(() => {
      this.isLongPress = true;
      this.longPressSubject.next({
        duration: Date.now() - this.touchStartTime,
        position: this.touchStartPosition
      });
    }, this.LONG_PRESS_DURATION);
  }
  
  private handleTouchMove(event: TouchEvent): void {
    const touch = event.touches[0];
    this.touchEndPosition = { x: touch.clientX, y: touch.clientY };
    
    // Cancel long press if user moves finger
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }
  
  private handleTouchEnd(event: TouchEvent): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    
    if (this.isLongPress) {
      return; // Don't process swipe if it was a long press
    }
    
    const touch = event.changedTouches[0];
    this.touchEndPosition = { x: touch.clientX, y: touch.clientY };
    
    const deltaX = this.touchEndPosition.x - this.touchStartPosition.x;
    const deltaY = this.touchEndPosition.y - this.touchStartPosition.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const duration = Date.now() - this.touchStartTime;
    const velocity = distance / duration;
    
    if (distance > this.SWIPE_THRESHOLD) {
      let direction: 'left' | 'right' | 'up' | 'down';
      
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        direction = deltaX > 0 ? 'right' : 'left';
      } else {
        direction = deltaY > 0 ? 'down' : 'up';
      }
      
      this.swipeSubject.next({ direction, distance, velocity });
    }
  }
  
  /**
   * Detect pull-to-refresh gesture
   */
  detectPullToRefresh(element: HTMLElement, onRefresh: () => void): void {
    let startY = 0;
    let currentY = 0;
    let isPulling = false;
    
    const handleTouchStart = (event: TouchEvent) => {
      if (element.scrollTop === 0) {
        startY = event.touches[0].clientY;
        isPulling = true;
      }
    };
    
    const handleTouchMove = (event: TouchEvent) => {
      if (!isPulling) return;
      
      currentY = event.touches[0].clientY;
      const pullDistance = currentY - startY;
      
      if (pullDistance > 100) {
        // Trigger refresh
        onRefresh();
        isPulling = false;
      }
    };
    
    const handleTouchEnd = () => {
      isPulling = false;
    };
    
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
  }
  
  /**
   * Detect double tap gesture
   */
  detectDoubleTap(element: HTMLElement, onDoubleTap: () => void): void {
    let lastTap = 0;
    const doubleTapDelay = 300;
    
    const handleTap = () => {
      const currentTime = new Date().getTime();
      const tapLength = currentTime - lastTap;
      
      if (tapLength < doubleTapDelay && tapLength > 0) {
        onDoubleTap();
      }
      lastTap = currentTime;
    };
    
    element.addEventListener('touchend', handleTap, { passive: true });
  }
}
