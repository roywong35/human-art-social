import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface PwaTheme {
  isPwaMode: boolean;
  isDarkMode: boolean;
  systemPrefersDark: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PwaService {
  private isPwaModeSubject = new BehaviorSubject<boolean>(false);
  private isDarkModeSubject = new BehaviorSubject<boolean>(false);
  private systemPrefersDarkSubject = new BehaviorSubject<boolean>(false);
  
  public isPwaMode$ = this.isPwaModeSubject.asObservable();
  public isDarkMode$ = this.isDarkModeSubject.asObservable();
  public systemPrefersDark$ = this.systemPrefersDarkSubject.asObservable();
  
  constructor() {
    this.checkPwaMode();
    this.checkDarkMode();
    this.setupPwaDetection();
    this.setupDarkModeDetection();
  }
  
  /**
   * Check if the app is running in PWA mode
   */
  private checkPwaMode(): void {
    const isPwa = this.detectPwaMode();
    this.isPwaModeSubject.next(isPwa);
    
    // Add PWA-specific classes to body
    if (isPwa) {
      document.body.classList.add('pwa-mode');
      document.documentElement.classList.add('pwa-mode');
    } else {
      document.body.classList.remove('pwa-mode');
      document.documentElement.classList.remove('pwa-mode');
    }
  }
  
  /**
   * Check current dark mode status
   */
  private checkDarkMode(): void {
    // Check system preference
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.systemPrefersDarkSubject.next(systemPrefersDark);
    
    // Check if user has manually set dark mode
    const userPrefersDark = document.body.classList.contains('dark');
    const isDarkMode = userPrefersDark || (systemPrefersDark && !document.body.classList.contains('light'));
    
    this.isDarkModeSubject.next(isDarkMode);
    
    // Apply appropriate theme
    this.applyTheme(isDarkMode);
  }
  
  /**
   * Apply theme to the document
   */
  private applyTheme(isDark: boolean): void {
    if (isDark) {
      document.body.classList.add('dark');
      document.body.classList.remove('light');
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.body.classList.add('light');
      document.body.classList.remove('dark');
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }
  
  /**
   * Detect PWA mode using multiple methods
   */
  private detectPwaMode(): boolean {
    // Method 1: Check display mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }
    
    // Method 2: Check iOS standalone mode
    if ((window.navigator as any).standalone === true) {
      return true;
    }
    
    // Method 3: Check if running in iframe (not PWA)
    if (window.self !== window.top) {
      return false;
    }
    
    // Method 4: Check for PWA-specific features
    if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
      // Additional checks could be added here
      return false; // Default to false for this method
    }
    
    return false;
  }
  
  /**
   * Setup PWA detection listeners
   */
  private setupPwaDetection(): void {
    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener('change', () => {
      this.checkPwaMode();
    });
    
    // Listen for orientation changes (common in PWA)
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.checkPwaMode();
      }, 100);
    });
  }
  
  /**
   * Setup dark mode detection listeners
   */
  private setupDarkModeDetection(): void {
    // Listen for system theme changes
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkModeQuery.addEventListener('change', () => {
      this.checkDarkMode();
    });
  }
  
  /**
   * Toggle dark mode manually
   */
  toggleDarkMode(): void {
    const currentDarkMode = this.isDarkModeSubject.value;
    this.isDarkModeSubject.next(!currentDarkMode);
    this.applyTheme(!currentDarkMode);
  }
  
  /**
   * Set dark mode explicitly
   */
  setDarkMode(isDark: boolean): void {
    this.isDarkModeSubject.next(isDark);
    this.applyTheme(isDark);
  }
  
  /**
   * Get current PWA mode status
   */
  get isPwaMode(): boolean {
    return this.isPwaModeSubject.value;
  }
  
  /**
   * Get current dark mode status
   */
  get isDarkMode(): boolean {
    return this.isDarkModeSubject.value;
  }
  
  /**
   * Get system dark mode preference
   */
  get systemPrefersDark(): boolean {
    return this.systemPrefersDarkSubject.value;
  }
  
  /**
   * Get current theme information
   */
  get currentTheme(): PwaTheme {
    return {
      isPwaMode: this.isPwaMode,
      isDarkMode: this.isDarkMode,
      systemPrefersDark: this.systemPrefersDark
    };
  }
  
  /**
   * Apply PWA-specific styles to an element
   */
  applyPwaStyles(element: HTMLElement): void {
    if (this.isPwaMode) {
      element.classList.add('pwa-mode');
      
      // Apply safe area padding
      const safeAreaTop = getComputedStyle(document.documentElement)
        .getPropertyValue('--safe-area-inset-top') || '0px';
      const safeAreaBottom = getComputedStyle(document.documentElement)
        .getPropertyValue('--safe-area-inset-bottom') || '0px';
      
      element.style.paddingTop = safeAreaTop;
      element.style.paddingBottom = safeAreaBottom;
    }
  }
  
  /**
   * Remove PWA-specific styles from an element
   */
  removePwaStyles(element: HTMLElement): void {
    element.classList.remove('pwa-mode');
    element.style.paddingTop = '';
    element.style.paddingBottom = '';
  }
}
