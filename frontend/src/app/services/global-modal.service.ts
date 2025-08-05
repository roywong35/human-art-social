import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { User } from '../models/user.model';

export interface UserPreviewModalState {
  isVisible: boolean;
  user: User | null;
  position: { x: number, y: number };
}

export interface ModalHoverCallback {
  clearLeaveTimeout: () => void;
}

@Injectable({
  providedIn: 'root'
})
export class GlobalModalService {
  private modalState = new BehaviorSubject<UserPreviewModalState>({
    isVisible: false,
    user: null,
    position: { x: 0, y: 0 }
  });

  modalState$ = this.modalState.asObservable();
  
  // Store the callback to clear leave timeout when modal is hovered
  private hoverCallback: ModalHoverCallback | null = null;

  showUserPreview(user: User, position: { x: number, y: number }): void {
    this.modalState.next({
      isVisible: true,
      user,
      position
    });
  }

  /**
   * Show user preview with accurate positioning (no shifting)
   * Uses provided user data which now includes bio from public posts endpoint
   */
  showUserPreviewAccurate(user: User, targetElement: Element, hoverCallback?: ModalHoverCallback): void {
    // Store the callback for modal hover
    this.hoverCallback = hoverCallback || null;
    
    // Use the provided user data directly (which now includes bio from public posts)
    this.modalState.next({
      isVisible: true,
      user,
      position: { x: -9999, y: -9999 } // Off-screen initially
    });

    // Wait for Angular to render the modal, then measure and position correctly
    setTimeout(() => {
      const modalElement = document.querySelector('.user-preview-modal') as HTMLElement;
      if (modalElement && targetElement) {
        // Temporarily make it visible but off-screen to measure
        modalElement.style.visibility = 'hidden';
        modalElement.style.left = '0px';
        modalElement.style.top = '0px';
        
        // Force a layout to get accurate measurements
        modalElement.offsetHeight;
        
        const modalRect = modalElement.getBoundingClientRect();
        const targetRect = targetElement.getBoundingClientRect();
        
        // Calculate perfect position with actual dimensions and element type
        const perfectPosition = this.calculateOptimalPositionFromRectWithElement(
          targetRect, 
          targetElement,
          modalRect.width, 
          modalRect.height
        );
        
        // Show modal at perfect position with user data (already includes bio!)
        modalElement.style.visibility = 'visible';
        this.modalState.next({
          isVisible: true,
          user, // User data already includes bio from public posts endpoint
          position: perfectPosition
        });
      }
    }, 16); // One frame delay to ensure rendering
  }

  hideUserPreview(): void {
    this.modalState.next({
      isVisible: false,
      user: null,
      position: { x: 0, y: 0 }
    });
    // Clear the callback when hiding
    this.hoverCallback = null;
  }

  onModalHover(): void {
    // Keep modal visible when hovering over it
    // This method is called when the mouse enters the modal
    // Clear the leave timeout in the component that opened the modal
    if (this.hoverCallback) {
      this.hoverCallback.clearLeaveTimeout();
    }
  }

  getCurrentState(): UserPreviewModalState {
    return this.modalState.value;
  }

  /**
   * Calculate optimal modal position - modal appears above/below element with no gap, horizontally centered
   */
  calculateOptimalPosition(event: MouseEvent, modalWidth: number = 320, modalHeight: number = 250): { x: number, y: number } {
    const rect = (event.target as Element).getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    

    
    // Calculate horizontal center alignment with enhanced text element detection
    const targetElement = event.target as Element;
    const isTextSpan = targetElement.tagName === 'SPAN' && 
                      (targetElement.className.includes('username-text') || targetElement.className.includes('handle-text'));
    const isTextElement = targetElement.tagName === 'DIV' && 
                         targetElement.textContent && 
                         targetElement.textContent.length > 0;
    const hasFlexGrow = targetElement.className.includes('flex-grow');
    
    let targetCenterX: number;
    
    if (isTextSpan) {
      // BEST: Use actual span dimensions for pixel-perfect positioning!
      targetCenterX = rect.left + rect.width / 2;
    } else if (isTextElement) {
      // FALLBACK: Estimate text width for divs (legacy support)
      const expectedTextWidthInit = targetElement.textContent ? targetElement.textContent.length * 15 : 0;
      const isUnusuallyWideInit = rect.width > Math.max(expectedTextWidthInit * 2, 180);
      
      if (hasFlexGrow || isUnusuallyWideInit) {
        const estimatedTextWidth = Math.min(targetElement.textContent!.length * 15, 250);
        targetCenterX = rect.left + estimatedTextWidth / 2;
      } else {
        targetCenterX = rect.left + rect.width / 2;
      }
    } else {
      // DEFAULT: Use element center (images, buttons, etc.)
      targetCenterX = rect.left + rect.width / 2;
    }
    
    let x = targetCenterX - modalWidth / 2;
    
    // Check space above and below
    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;
    

    
    let y: number;
    let chosenPosition: string;
    
    // Decide whether to show above or below - prioritize ABOVE like Twitter/X
    if (spaceAbove >= modalHeight + 16) {
      // Show above - modal bottom edge touches element top edge (preferred)
      y = rect.top - modalHeight;
      chosenPosition = 'above (preferred)';
      console.log('🔧 DEBUG: Positioning ABOVE:', {
        elementTop: rect.top,
        modalHeight: modalHeight,
        calculatedY: y,
        modalBottom: y + modalHeight,
        gapBetweenModalAndElement: rect.top - (y + modalHeight)
      });
    } else if (spaceBelow >= modalHeight + 16) {
      // Show below - modal top edge touches element bottom edge (fallback)
      y = rect.bottom;
      chosenPosition = 'below (fallback)';
    } else {
      // Not enough space above or below, choose the side with more space
      if (spaceAbove > spaceBelow) {
        // Show above but clamp to viewport
        y = rect.top - modalHeight;
        if (y < 8) {
          y = 8;
        }
        chosenPosition = 'above (clamped)';
      } else {
        // Show below but clamp to viewport
        y = rect.bottom;
        if (y + modalHeight > viewportHeight - 8) {
          y = viewportHeight - modalHeight - 8;
        }
        chosenPosition = 'below (clamped)';
      }
    }
    
    // Horizontal bounds checking - keep center alignment when possible
    if (x < 8) {
      x = 8;
    } else if (x + modalWidth > viewportWidth - 8) {
      x = viewportWidth - modalWidth - 8;
    }
    

    
    return { x, y };
  }

  /**
   * Calculate optimal position using a DOMRect directly (for recalculation)
   */
  calculateOptimalPositionFromRect(targetRect: DOMRect, modalWidth: number = 320, modalHeight: number = 250): { x: number, y: number } {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Calculate horizontal center alignment
    const targetCenterX = targetRect.left + targetRect.width / 2;
    let x = targetCenterX - modalWidth / 2;
    
    // Check space above and below
    const spaceAbove = targetRect.top;
    const spaceBelow = viewportHeight - targetRect.bottom;
    
    let y: number;
    let chosenPosition: string;
    
    // Decide whether to show above or below - prioritize ABOVE like Twitter/X
    if (spaceAbove >= modalHeight + 16) {
      // Show above - modal bottom edge touches element top edge (preferred)
      y = targetRect.top - modalHeight;
      chosenPosition = 'above (preferred)';
    } else if (spaceBelow >= modalHeight + 16) {
      // Show below - modal top edge touches element bottom edge (fallback)
      y = targetRect.bottom;
      chosenPosition = 'below (fallback)';
    } else {
      // Not enough space above or below, choose the side with more space
      if (spaceAbove > spaceBelow) {
        // Show above but clamp to viewport
        y = targetRect.top - modalHeight;
        if (y < 8) {
          y = 8;
        }
        chosenPosition = 'above (clamped)';
      } else {
        // Show below but clamp to viewport
        y = targetRect.bottom;
        if (y + modalHeight > viewportHeight - 8) {
          y = viewportHeight - modalHeight - 8;
        }
        chosenPosition = 'below (clamped)';
      }
    }
    
    // Horizontal bounds checking - keep center alignment when possible
    if (x < 8) {
      x = 8;
    } else if (x + modalWidth > viewportWidth - 8) {
      x = viewportWidth - modalWidth - 8;
    }
    
    return { x, y };
  }

  /**
   * Calculate optimal position using a DOMRect and element info (handles text elements better)
   */
  calculateOptimalPositionFromRectWithElement(targetRect: DOMRect, targetElement: Element, modalWidth: number = 320, modalHeight: number = 250): { x: number, y: number } {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Detect if this is a span with actual text (perfect for positioning)
    const isTextSpan = targetElement.tagName === 'SPAN' && 
                      (targetElement.className.includes('username-text') || targetElement.className.includes('handle-text'));
    
    // Detect if this is a wide div that needs text width estimation (fallback)
    const isTextElement = targetElement.tagName === 'DIV' && 
                         targetElement.textContent && 
                         targetElement.textContent.length > 0;
    
    const hasFlexGrow = targetElement.className.includes('flex-grow');
    const expectedTextWidth = targetElement.textContent ? targetElement.textContent.length * 15 : 0;
    const isUnusuallyWide = targetRect.width > Math.max(expectedTextWidth * 2, 180);
    
    let targetCenterX: number;
    
    if (isTextSpan) {
      // BEST: Use actual span dimensions for pixel-perfect positioning!
      targetCenterX = targetRect.left + targetRect.width / 2;
    } else if (isTextElement && (hasFlexGrow || isUnusuallyWide)) {
      // FALLBACK: Estimate text width for wide divs
      const estimatedTextWidth = Math.min(targetElement.textContent!.length * 15, 250);
      targetCenterX = targetRect.left + estimatedTextWidth / 2;
    } else {
      // DEFAULT: Use element center (good for images, buttons, etc.)
      targetCenterX = targetRect.left + targetRect.width / 2;
    }
    
    let x = targetCenterX - modalWidth / 2;
    
    // Check space above and below
    const spaceAbove = targetRect.top;
    const spaceBelow = viewportHeight - targetRect.bottom;
    
    let y: number;
    let chosenPosition: string;
    
    // Decide whether to show above or below - prioritize ABOVE like Twitter/X
    if (spaceAbove >= modalHeight + 16) {
      // Show above - modal bottom edge touches element top edge (preferred)
      y = targetRect.top - modalHeight;
      chosenPosition = 'above (preferred)';
    } else if (spaceBelow >= modalHeight + 16) {
      // Show below - modal top edge touches element bottom edge (fallback)
      y = targetRect.bottom;
      chosenPosition = 'below (fallback)';
    } else {
      // Not enough space above or below, choose the side with more space
      if (spaceAbove > spaceBelow) {
        // Show above but clamp to viewport
        y = targetRect.top - modalHeight;
        if (y < 8) {
          y = 8;
        }
        chosenPosition = 'above (clamped)';
      } else {
        // Show below but clamp to viewport
        y = targetRect.bottom;
        if (y + modalHeight > viewportHeight - 8) {
          y = viewportHeight - modalHeight - 8;
        }
        chosenPosition = 'below (clamped)';
      }
    }
    
    // Horizontal bounds checking - keep center alignment when possible
    if (x < 8) {
      x = 8;
    } else if (x + modalWidth > viewportWidth - 8) {
      x = viewportWidth - modalWidth - 8;
    }
    
    return { x, y };
  }

  /**
   * Update position after modal is rendered with actual dimensions
   */
  updatePositionWithActualModalSize(originalEvent: MouseEvent, modalElement: HTMLElement): { x: number, y: number } {
    const rect = modalElement.getBoundingClientRect();
    const actualWidth = rect.width;
    const actualHeight = rect.height;
    
    // Recalculate with actual dimensions
    const newPosition = this.calculateOptimalPosition(originalEvent, actualWidth, actualHeight);
    
    return newPosition;
  }
} 