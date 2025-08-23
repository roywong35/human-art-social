import { Component, OnInit, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PwaService } from './services/pwa.service';

@Component({
  selector: 'app-pwa-layout',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pwa-container" [class.dark]="isDarkMode">
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    .pwa-container {
      min-height: 100vh;
      background-color: var(--pwa-background-light, #ffffff);
      padding-top: var(--safe-area-inset-top, 0px);
      padding-bottom: var(--safe-area-inset-bottom, 0px);
      transition: background-color 0.3s ease;
    }
    
    .pwa-container.dark {
      background-color: var(--pwa-background-dark, #000000);
    }
    
    /* PWA-specific styles */
    @media (display-mode: standalone) {
      .pwa-container {
        background-color: var(--pwa-background-light, #ffffff) !important;
      }
      
      .pwa-container.dark {
        background-color: var(--pwa-background-dark, #000000) !important;
      }
      
      /* Ensure bottom navigation doesn't overlap with phone UI */
      .bottom-navigation,
      [class*="bottom-nav"],
      [class*="bottom-navigation"],
      .nav-bottom {
        padding-bottom: max(20px, var(--safe-area-inset-bottom, 20px)) !important;
        margin-bottom: 0 !important;
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background-color: var(--pwa-background-light, #ffffff);
        z-index: 1000;
        box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
        transition: background-color 0.3s ease;
      }
      
      .pwa-container.dark .bottom-navigation,
      .pwa-container.dark [class*="bottom-nav"],
      .pwa-container.dark [class*="bottom-navigation"],
      .pwa-container.dark .nav-bottom {
        background-color: var(--pwa-background-dark, #000000);
        box-shadow: 0 -2px 10px rgba(255, 255, 255, 0.1);
      }
      
      /* Add padding to main content to prevent overlap */
      .main-content {
        padding-bottom: calc(80px + var(--safe-area-inset-bottom, 20px));
      }
    }
    
    /* General safe area handling */
    @supports (padding: max(0px)) {
      .pwa-container {
        padding-top: max(20px, var(--safe-area-inset-top, 20px));
        padding-bottom: max(20px, var(--safe-area-inset-bottom, 20px));
      }
    }
    
    /* Dark mode transitions */
    .pwa-container,
    .pwa-container * {
      transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
    }
  `]
})
export class PwaLayoutComponent implements OnInit {
  @HostBinding('class.pwa-mode') isPwaMode = false;
  @HostBinding('class.dark-mode') isDarkMode = false;
  
  constructor(private pwaService: PwaService) {}
  
  ngOnInit() {
    this.checkPwaMode();
    this.setupThemeSubscription();
  }
  
  private checkPwaMode(): void {
    // Check if running as PWA
    if (window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true) {
      this.isPwaMode = true;
      document.body.classList.add('pwa-mode');
    } else {
      this.isPwaMode = false;
      document.body.classList.remove('pwa-mode');
    }
  }
  
  private setupThemeSubscription(): void {
    // Subscribe to dark mode changes
    this.pwaService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });
  }
}
