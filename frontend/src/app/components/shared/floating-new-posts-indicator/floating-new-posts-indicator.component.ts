import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostListener, ChangeDetectorRef, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-floating-new-posts-indicator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './floating-new-posts-indicator.component.html',

})
export class FloatingNewPostsIndicatorComponent implements OnInit, OnDestroy, OnChanges {
  @Input() hasNewPosts = false;
  @Input() newPostsCount = 0;
  @Input() newPostsAuthors: Array<{ avatar?: string, username: string }> = [];
  @Input() isTabHidden = false; // Whether the tab bar is hidden on mobile
  @Input() isMobile = false; // Whether we're on mobile
  @Output() showNewPosts = new EventEmitter<void>();

  isVisible = false;
  private scrollThreshold = 100; // Show when scrolled down more than 100px
  private homeComponentCenter = 0; // Dynamic center position
  
  // Default avatar for users without profile pictures
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  constructor(private cd: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.checkScrollPosition();
    this.calculateHomeComponentCenter();
  }

  ngOnDestroy(): void {
    // Cleanup handled by HostListener
  }

  @HostListener('window:scroll', ['$event'])
  onScroll(): void {
    this.checkScrollPosition();
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    this.calculateHomeComponentCenter();
  }

  private checkScrollPosition(): void {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const shouldShow = this.hasNewPosts && scrollTop > this.scrollThreshold;
    
    if (this.isVisible !== shouldShow) {
      this.isVisible = shouldShow;
      this.cd.markForCheck();
    }
  }

  onShowNewPosts(): void {
    // Jump to the very top of the page
    window.scrollTo({ top: 0, behavior: 'auto' });
    // Emit the event to show new posts
    this.showNewPosts.emit();
  }

  // Get authors to display (limit to 3 for the oval)
  getDisplayAuthors(): Array<{ avatar?: string, username: string }> {
    return this.newPostsAuthors.slice(0, 3);
  }

  onImageError(event: any): void {
    if (event.target) {
      (event.target as HTMLElement).style.display = 'none';
    }
  }

  private calculateHomeComponentCenter(): void {
    // Find the home component container
    const homeContainer = document.querySelector('.home-container') || 
                         document.querySelector('[class*="home-container"]') ||
                         document.querySelector('.flex.flex-col.min-h-screen');
    
    if (homeContainer) {
      const rect = homeContainer.getBoundingClientRect();
      const centerX = rect.left + (rect.width / 2);
      this.homeComponentCenter = centerX;
    } else {
      // Fallback: center of viewport
      this.homeComponentCenter = window.innerWidth / 2;
    }
  }

  // Get the dynamic left position for centering
  getDynamicLeftPosition(): string {
    if (this.homeComponentCenter > 0) {
      return `${this.homeComponentCenter}px`;
    }
    return '50%'; // Fallback
  }

  // Get the dynamic top position based on tab bar visibility
  getDynamicTopPosition(): string {
    if (this.isMobile && this.isTabHidden) {
      return 'top-4'; // Higher position when tab bar is hidden on mobile
    }
    return 'top-16'; // Default position below tab bar
  }

  // Watch for changes in tab bar visibility to trigger smooth transitions
  ngOnChanges(changes: SimpleChanges): void {
    // This will be called whenever inputs change, allowing smooth transitions
    if (this.isVisible && (changes['isTabHidden'] || changes['isMobile'])) {
      // Force a re-render to trigger the CSS transition
      this.cd.markForCheck();
    }
  }
}
