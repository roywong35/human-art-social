import { Component, ElementRef, OnInit, OnDestroy, HostBinding, Renderer2, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { SearchBarComponent } from '../../widgets/search-bar/search-bar.component';
import { HashtagResult, HashtagService } from '../../../services/hashtag.service';
import { UserService } from '../../../services/user.service';
import { User } from '../../../models';
import { GlobalModalService } from '../../../services/global-modal.service';

interface TrendingTopic {
  name: string;
  postCount: number;
  category: string;
}

interface UserWithState extends User {
  isFollowLoading?: boolean;
  isHoveringFollowButton?: boolean;
}

@Component({
  selector: 'app-right-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SearchBarComponent],
  templateUrl: './right-sidebar.component.html',
  styleUrls: ['./right-sidebar.component.scss']
})
export class RightSidebarComponent implements OnInit, OnDestroy {
  @HostBinding('class.sticky') isSticky = false;
  private initialTop: number | null = null;
  private sidebarHeight: number = 0;
  private sidebarWidth: number = 0;
  private lastScrollY: number = 0;
  selectedTimeframe: 'hour' | 'day' = 'hour';
  isRefreshing = false;
  trendingTopics: HashtagResult[] = [];
  readonly maxTrendingTopics = 5;
  recommendedUsers: UserWithState[] = [];
  isLoadingUsers = false;
  readonly maxRecommendedUsers = 3;
  defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  // User preview modal - now handled by GlobalModalService
  private hoverTimeout: any;
  private leaveTimeout: any;

  get displayedUsers(): UserWithState[] {
    return this.recommendedUsers.slice(0, this.maxRecommendedUsers);
  }

  get userPlaceholderCount(): number {
    return Math.max(0, this.maxRecommendedUsers - this.displayedUsers.length);
  }

  get userPlaceholderArray(): number[] {
    return Array(this.userPlaceholderCount).fill(0);
  }

  get placeholderCount(): number {
    return Math.max(0, this.maxTrendingTopics - this.trendingTopics.length);
  }

  get placeholderArray(): number[] {
    return Array(this.placeholderCount).fill(0);
  }

  private scrollHandler: () => void;
  private destroy$ = new Subject<void>();

  constructor(
    private elementRef: ElementRef,
    private renderer: Renderer2,
    private hashtagService: HashtagService,
    private userService: UserService,
    private router: Router,
    private cd: ChangeDetectorRef,
    private globalModalService: GlobalModalService
  ) {
    this.scrollHandler = () => {
      const rect = this.elementRef.nativeElement.getBoundingClientRect();
      if (this.initialTop === null) {
        this.initialTop = rect.top + window.scrollY;
        // Store the initial width if not already set
        if (!this.sidebarWidth) {
          this.sidebarWidth = rect.width;
        }
      }
      
      // Update height on every scroll
      this.sidebarHeight = rect.height;

      const scrollY = window.scrollY;
      const viewportHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      // Check if viewport has enough height for the sidebar
      const hasEnoughHeight = viewportHeight >= this.sidebarHeight;

      if (hasEnoughHeight) {
        // If viewport is tall enough, keep sidebar fixed at the top
        this.isSticky = true;
        this.renderer.setStyle(this.elementRef.nativeElement, 'position', 'fixed');
        this.renderer.setStyle(this.elementRef.nativeElement, 'top', '0');
        this.renderer.setStyle(this.elementRef.nativeElement, 'width', `${this.sidebarWidth}px`);
        // Force change detection after style changes
        this.cd.detectChanges();
      } else {
        // If viewport is not tall enough, use the original scroll-based logic
        const shouldBeSticky = this.initialTop !== null && 
                             scrollY > (this.initialTop + this.sidebarHeight - viewportHeight);

        if (shouldBeSticky) {
          this.isSticky = true;
          const topPosition = viewportHeight - this.sidebarHeight;
          this.renderer.setStyle(this.elementRef.nativeElement, 'position', 'fixed');
          this.renderer.setStyle(this.elementRef.nativeElement, 'top', `${topPosition}px`);
          this.renderer.setStyle(this.elementRef.nativeElement, 'width', `${this.sidebarWidth}px`);
          // Force change detection after style changes
          this.cd.detectChanges();
        } else {
          this.isSticky = false;
          this.renderer.removeStyle(this.elementRef.nativeElement, 'position');
          this.renderer.removeStyle(this.elementRef.nativeElement, 'top');
          this.renderer.removeStyle(this.elementRef.nativeElement, 'width');
          // Force change detection after style changes
          this.cd.detectChanges();
        }
      }
    };
  }

  ngOnInit() {
    // Initial calculation
    setTimeout(() => {
      const rect = this.elementRef.nativeElement.getBoundingClientRect();
      this.initialTop = rect.top + window.scrollY;
      this.sidebarHeight = rect.height;
      this.sidebarWidth = rect.width; // Store the initial width
    }, 0);

    window.addEventListener('scroll', this.scrollHandler, { passive: true });
    this.loadTrending();
    this.loadRecommendedUsers();
  }

  ngOnDestroy() {
    window.removeEventListener('scroll', this.scrollHandler);
    
    // Clean up user preview modal timeouts
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }
    if (this.leaveTimeout) {
      clearTimeout(this.leaveTimeout);
    }
  }

  onTimeframeChange() {
    this.loadTrending();
  }

  refreshTrending() {
    this.isRefreshing = true;
    this.hashtagService.calculateTrending(this.selectedTimeframe).subscribe({
      next: (response) => {
        this.trendingTopics = response.results;
        this.isRefreshing = false;
      },
      error: (error) => {
        console.error('Error refreshing trending:', error);
        this.isRefreshing = false;
      }
    });
  }

  private loadTrending() {
    this.hashtagService.getTrendingHashtags(this.selectedTimeframe).subscribe({
      next: (response) => {
        this.trendingTopics = response.results;
      },
      error: (error) => {
        console.error('Error loading trending:', error);
      }
    });
  }

  formatCount(count: number): string {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    }
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count.toString();
  }

  navigateToHashtag(hashtag: string) {
    this.router.navigate(['/search'], { queryParams: { q: `#${hashtag}` } });
  }

  private loadRecommendedUsers() {
    this.isLoadingUsers = true;
    this.userService.getRecommendedUsers().subscribe({
      next: (users) => {
        this.recommendedUsers = users.map(user => ({
          ...user,
          isFollowLoading: false,
          isHoveringFollowButton: false
        }));
        this.isLoadingUsers = false;
      },
      error: (error) => {
        console.error('Error loading recommended users:', error);
        this.isLoadingUsers = false;
      }
    });
  }

  navigateToProfile(handle: string) {
    this.router.navigate(['/', handle]);
  }

  followUser(user: UserWithState, event: Event) {
    event.stopPropagation(); // Prevent navigation when clicking follow button
    if (user.isFollowLoading) return;

    user.isFollowLoading = true;
    this.userService.followUser(user.handle).subscribe({
      next: (updatedUser) => {
        // Update the user in the list
        const index = this.recommendedUsers.findIndex(u => u.handle === user.handle);
        if (index !== -1) {
          this.recommendedUsers[index] = {
            ...updatedUser,
            isFollowLoading: false,
            isHoveringFollowButton: false
          };
        }
      },
      error: (error) => {
        console.error('Error following user:', error);
        user.isFollowLoading = false;
      }
    });
  }

  onFollowButtonHover(user: UserWithState, isHovering: boolean) {
    user.isHoveringFollowButton = isHovering;
  }

  // User preview modal methods
  protected onUserHover(event: MouseEvent, user: User): void {

    
    // Clear any pending timeouts
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }
    if (this.leaveTimeout) {
      clearTimeout(this.leaveTimeout);
    }

    this.hoverTimeout = setTimeout(() => {

      
      const targetElement = event.target as Element;
      
      
      
      // Use the new accurate positioning method (no shifting!)
      this.globalModalService.showUserPreviewAccurate(user, targetElement);
    }, 300);
  }

  protected onUserHoverLeave(): void {

    
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }
    
    // Delay hiding to allow moving to the modal
    this.leaveTimeout = setTimeout(() => {
      if (!this.globalModalService.getCurrentState().isVisible) return;

      this.globalModalService.hideUserPreview();
    }, 300);
  }

  protected onModalHover(): void {
    // When hovering over the modal, cancel any pending close
    if (this.leaveTimeout) {
      clearTimeout(this.leaveTimeout);
    }
    this.globalModalService.onModalHover();
  }

  protected closeUserPreview(): void {
    // Clear any pending timeouts
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }
    if (this.leaveTimeout) {
      clearTimeout(this.leaveTimeout);
    }
    
    this.globalModalService.hideUserPreview();
  }
} 