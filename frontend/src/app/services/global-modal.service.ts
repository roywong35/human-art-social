import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { User } from '../models/user.model';

export interface UserPreviewModalState {
  isVisible: boolean;
  user: User | null;
  position: { x: number, y: number };
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

  showUserPreview(user: User, position: { x: number, y: number }): void {
    console.log('🎯 GlobalModalService: Showing user preview for', user.username, 'at', position);
    this.modalState.next({
      isVisible: true,
      user,
      position
    });
  }

  /**
   * Show user preview with accurate positioning (no shifting)
   */
  showUserPreviewAccurate(user: User, targetElement: Element): void {
    console.log('🎯 GlobalModalService: Preparing accurate positioning for', user.username);
    
    // First, show modal hidden to measure dimensions
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
        
        console.log('🔧 Accurate positioning: Measured dimensions:', {
          modalWidth: modalRect.width,
          modalHeight: modalRect.height,
          targetRect: {
            left: targetRect.left,
            top: targetRect.top,
            width: targetRect.width,
            height: targetRect.height
          }
        });
        
        // Calculate perfect position with actual dimensions
        const perfectPosition = this.calculateOptimalPositionFromRect(
          targetRect, 
          modalRect.width, 
          modalRect.height
        );
        
        console.log('🎯 Accurate positioning: Perfect position calculated:', perfectPosition);
        
        // Show modal at perfect position
        modalElement.style.visibility = 'visible';
        this.modalState.next({
          isVisible: true,
          user,
          position: perfectPosition
        });
        
        console.log('✅ Modal positioned perfectly with no shifting!');
      }
    }, 16); // One frame delay to ensure rendering
  }

  hideUserPreview(): void {
    console.log('🎯 GlobalModalService: Hiding user preview');
    this.modalState.next({
      isVisible: false,
      user: null,
      position: { x: 0, y: 0 }
    });
  }

  onModalHover(): void {
    // Keep modal visible when hovering over it
    console.log('🎯 GlobalModalService: Modal hover detected');
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
    
    console.log('🔧 DEBUG: Starting position calculation with:', {
      assumedModalWidth: modalWidth,
      assumedModalHeight: modalHeight,
      targetElement: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      },
      viewport: {
        width: viewportWidth,
        height: viewportHeight
      }
    });
    
    // Calculate horizontal center alignment
    const targetCenterX = rect.left + rect.width / 2;
    let x = targetCenterX - modalWidth / 2;
    
    // Check space above and below
    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;
    
    console.log('🔧 DEBUG: Space calculation:', {
      spaceAbove: spaceAbove,
      spaceBelow: spaceBelow,
      requiredSpace: modalHeight + 16,
      canFitAbove: spaceAbove >= modalHeight + 16,
      canFitBelow: spaceBelow >= modalHeight + 16
    });
    
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
      console.log('🔧 DEBUG: Positioning BELOW:', {
        elementBottom: rect.bottom,
        calculatedY: y,
        modalBottom: y + modalHeight,
        gapBetweenElementAndModal: y - rect.bottom
      });
    } else {
      // Not enough space above or below, choose the side with more space
      if (spaceAbove > spaceBelow) {
        // Show above but clamp to viewport
        y = rect.top - modalHeight;
        if (y < 8) {
          y = 8;
        }
        chosenPosition = 'above (clamped)';
        console.log('🔧 DEBUG: Positioning ABOVE (clamped):', {
          elementTop: rect.top,
          modalHeight: modalHeight,
          calculatedY: y,
          wasClamped: (rect.top - modalHeight) < 8
        });
      } else {
        // Show below but clamp to viewport
        y = rect.bottom;
        if (y + modalHeight > viewportHeight - 8) {
          y = viewportHeight - modalHeight - 8;
        }
        chosenPosition = 'below (clamped)';
        console.log('🔧 DEBUG: Positioning BELOW (clamped):', {
          elementBottom: rect.bottom,
          calculatedY: y,
          modalBottom: y + modalHeight,
          wasClamped: (rect.bottom + modalHeight) > (viewportHeight - 8)
        });
      }
    }
    
    // Horizontal bounds checking - keep center alignment when possible
    if (x < 8) {
      x = 8;
    } else if (x + modalWidth > viewportWidth - 8) {
      x = viewportWidth - modalWidth - 8;
    }
    
    console.log('🎯 FINAL position calculated:', {
      targetRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height, bottom: rect.bottom },
      targetCenterX,
      modalPosition: { x, y },
      spaceAbove,
      spaceBelow,
      positioning: chosenPosition,
      assumedModalDimensions: { width: modalWidth, height: modalHeight }
    });
    
    return { x, y };
  }

  /**
   * Calculate optimal position using a DOMRect directly (for recalculation)
   */
  calculateOptimalPositionFromRect(targetRect: DOMRect, modalWidth: number = 320, modalHeight: number = 250): { x: number, y: number } {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    console.log('🔧 DEBUG: Recalculating position from rect with:', {
      modalWidth: modalWidth,
      modalHeight: modalHeight,
      targetElement: {
        left: targetRect.left,
        top: targetRect.top,
        right: targetRect.right,
        bottom: targetRect.bottom,
        width: targetRect.width,
        height: targetRect.height
      },
      viewport: {
        width: viewportWidth,
        height: viewportHeight
      }
    });
    
    // Calculate horizontal center alignment
    const targetCenterX = targetRect.left + targetRect.width / 2;
    let x = targetCenterX - modalWidth / 2;
    
    // Check space above and below
    const spaceAbove = targetRect.top;
    const spaceBelow = viewportHeight - targetRect.bottom;
    
    console.log('🔧 DEBUG: Space recalculation:', {
      spaceAbove: spaceAbove,
      spaceBelow: spaceBelow,
      requiredSpace: modalHeight + 16,
      canFitAbove: spaceAbove >= modalHeight + 16,
      canFitBelow: spaceBelow >= modalHeight + 16
    });
    
    let y: number;
    let chosenPosition: string;
    
    // Decide whether to show above or below - prioritize ABOVE like Twitter/X
    if (spaceAbove >= modalHeight + 16) {
      // Show above - modal bottom edge touches element top edge (preferred)
      y = targetRect.top - modalHeight;
      chosenPosition = 'above (preferred)';
      console.log('🔧 DEBUG: Repositioning ABOVE:', {
        elementTop: targetRect.top,
        modalHeight: modalHeight,
        calculatedY: y,
        modalBottom: y + modalHeight,
        gapBetweenModalAndElement: targetRect.top - (y + modalHeight)
      });
    } else if (spaceBelow >= modalHeight + 16) {
      // Show below - modal top edge touches element bottom edge (fallback)
      y = targetRect.bottom;
      chosenPosition = 'below (fallback)';
      console.log('🔧 DEBUG: Repositioning BELOW:', {
        elementBottom: targetRect.bottom,
        calculatedY: y,
        modalBottom: y + modalHeight,
        gapBetweenElementAndModal: y - targetRect.bottom
      });
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
    
    console.log('🎯 RECALCULATED position:', {
      targetRect: { left: targetRect.left, top: targetRect.top, width: targetRect.width, height: targetRect.height, bottom: targetRect.bottom },
      targetCenterX,
      modalPosition: { x, y },
      spaceAbove,
      spaceBelow,
      positioning: chosenPosition,
      actualModalDimensions: { width: modalWidth, height: modalHeight }
    });
    
    return { x, y };
  }

  /**
   * Update position after modal is rendered with actual dimensions
   */
  updatePositionWithActualModalSize(originalEvent: MouseEvent, modalElement: HTMLElement): { x: number, y: number } {
    const rect = modalElement.getBoundingClientRect();
    const actualWidth = rect.width;
    const actualHeight = rect.height;
    
    console.log('🔧 DEBUG: Actual modal dimensions:', {
      actualWidth,
      actualHeight,
      assumedDimensions: { width: 320, height: 250 },
      difference: { 
        width: actualWidth - 320, 
        height: actualHeight - 250 
      }
    });
    
    // Recalculate with actual dimensions
    const newPosition = this.calculateOptimalPosition(originalEvent, actualWidth, actualHeight);
    
    console.log('🔧 DEBUG: Position correction:', {
      originalAssumedHeight: 250,
      actualHeight: actualHeight,
      heightDifference: actualHeight - 250,
      newPosition: newPosition
    });
    
    return newPosition;
  }
} 