import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { filter, take } from 'rxjs/operators';
import { NewPostModalComponent } from '../../features/posts/new-post-modal/new-post-modal.component';
import { NewArtPostModalComponent } from '../../features/posts/new-art-post-modal/new-art-post-modal';

@Component({
  selector: 'app-floating-create-post-button',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './floating-create-post-button.component.html',
  styleUrls: ['./floating-create-post-button.component.scss']
})
export class FloatingCreatePostButtonComponent implements OnInit, OnDestroy {
  isVisible = false;
  isHomepage = false;
  isHumanArtTab = false;
  
  // Scroll-based visibility properties
  private lastScrollTop = 0;
  private scrollThreshold = 50; // Same threshold as mobile header
  private showThreshold = 150; // Show button after scrolling down 150px to account for new position

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private dialog: MatDialog
  ) {
    // Subscribe to route changes to detect Human Art tab and homepage
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      // Check if we're on the homepage (including with query params)
      this.isHomepage = event.url === '/' || event.url.startsWith('/home');
      
      // Check both URL and query params for human art tab
      this.route.queryParams.pipe(take(1)).subscribe(params => {
        this.isHumanArtTab = event.url.includes('human-art') || params['tab'] === 'human-drawing';
      });
    });
  }

  ngOnInit() {
    // Initialize the homepage and human art tab state
    this.isHomepage = this.router.url === '/' || this.router.url.startsWith('/home');
    this.route.queryParams.pipe(take(1)).subscribe(params => {
      this.isHumanArtTab = this.router.url.includes('human-art') || params['tab'] === 'human-drawing';
    });
    
    // Also check localStorage for the active tab
    const activeTab = localStorage.getItem('activeTab');
    if (activeTab === 'human-drawing') {
      this.isHumanArtTab = true;
    }
    
    // Set up periodic check for tab changes
    setInterval(() => {
      this.checkCurrentTab();
    }, 1000); // Check every second
  }

  @HostListener('window:scroll', ['$event'])
  onScroll(): void {
    const scrollTop = document.documentElement.scrollTop;
    const scrollDelta = scrollTop - this.lastScrollTop;
    
    // Only show button on homepage and when scrolling down
    if (this.isHomepage) {
      if (scrollDelta > 0 && scrollTop > this.showThreshold) {
        // Scrolling down and past threshold - show button
        this.isVisible = true;
      } else if (scrollDelta < 0 || scrollTop <= this.showThreshold) {
        // Scrolling up or near top - hide button
        this.isVisible = false;
      }
    } else {
      // Not on homepage - hide button
      this.isVisible = false;
    }
    
    this.lastScrollTop = scrollTop;
  }

  // Listen for tab changes from localStorage
  @HostListener('window:storage', ['$event'])
  onStorageChange(event: StorageEvent) {
    if (event.key === 'activeTab') {
      this.isHumanArtTab = event.newValue === 'human-drawing';
    }
  }

  // Method to check current tab state
  private checkCurrentTab(): void {
    const activeTab = localStorage.getItem('activeTab');
    this.isHumanArtTab = activeTab === 'human-drawing';
  }

  // Public method to refresh tab state (can be called from parent component)
  refreshTabState(): void {
    this.checkCurrentTab();
  }

  openCreatePostModal(): void {
    if (this.isHumanArtTab) {
      this.dialog.open(NewArtPostModalComponent, {
        panelClass: ['submit-drawing-dialog'],
        maxWidth: '90vw',
        maxHeight: '90vh',
        disableClose: false,
        hasBackdrop: true
      });
    } else {
      this.dialog.open(NewPostModalComponent, {
        panelClass: ['create-post-dialog'],
        maxWidth: '90vw',
        maxHeight: '90vh',
        disableClose: false,
        hasBackdrop: true
      });
    }
  }

  ngOnDestroy(): void {
    // Clean up any subscriptions or observers if needed
  }
}
