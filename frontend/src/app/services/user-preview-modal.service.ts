import { Injectable, ComponentRef, ViewContainerRef, ApplicationRef, ComponentFactoryResolver, Injector } from '@angular/core';
import { UserPreviewModalComponent } from '../components/shared/user-preview-modal/user-preview-modal.component';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserPreviewModalService {
  private modalRef: ComponentRef<UserPreviewModalComponent> | null = null;

  constructor(
    private appRef: ApplicationRef,
    private injector: Injector
  ) {}

  showModal(user: User, position: { x: number, y: number }): void {
    this.hideModal(); // Hide any existing modal

    // Create component at app root level (bypasses all stacking contexts)
    const componentRef = this.appRef.bootstrap(UserPreviewModalComponent, document.body);
    
    // Set component inputs
    componentRef.instance.user = user;
    componentRef.instance.position = position;
    componentRef.instance.isVisible = true;

    // Handle component outputs
    componentRef.instance.close.subscribe(() => {
      this.hideModal();
    });

    componentRef.instance.modalHover.subscribe(() => {
      // Modal hover - keep it visible
    });

    componentRef.instance.modalLeave.subscribe(() => {
      // Give time to move back to trigger element
      setTimeout(() => {
        this.hideModal();
      }, 300);
    });

    this.modalRef = componentRef;

    console.log('🎯 Modal created at app root level');
  }

  hideModal(): void {
    if (this.modalRef) {
      this.modalRef.destroy();
      this.modalRef = null;
      console.log('🎯 Modal destroyed');
    }
  }

  updatePosition(position: { x: number, y: number }): void {
    if (this.modalRef) {
      this.modalRef.instance.position = position;
    }
  }
} 