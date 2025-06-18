import { Component, ElementRef, OnInit, OnDestroy, HostBinding, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SearchBarComponent } from '../search-bar/search-bar.component';
import { HashtagService, HashtagResult } from '../../services/hashtag.service';
import { UserService } from '../../services/user.service';
import { Router } from '@angular/router';
import { User } from '../../models/user.model';

interface TrendingTopic {
  name: string;
  postCount: number;
  category: string;
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
  selectedTimeframe: 'hour' | 'day' = 'hour';
  isRefreshing = false;
  trendingTopics: HashtagResult[] = [];
  readonly maxTrendingTopics = 5;
  recommendedUsers: User[] = [];
  isLoadingUsers = false;

  get placeholderCount(): number {
    return Math.max(0, this.maxTrendingTopics - this.trendingTopics.length);
  }

  get placeholderArray(): number[] {
    return Array(this.placeholderCount).fill(0);
  }

  private scrollHandler: () => void;

  constructor(
    private elementRef: ElementRef,
    private renderer: Renderer2,
    private hashtagService: HashtagService,
    private userService: UserService,
    private router: Router
  ) {
    this.scrollHandler = () => {
      if (this.initialTop === null) {
        const rect = this.elementRef.nativeElement.getBoundingClientRect();
        this.initialTop = rect.top + window.scrollY;
        this.sidebarHeight = rect.height;
      }

      const scrollY = window.scrollY;
      const viewportHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const maxScroll = documentHeight - viewportHeight;
      
      // Only apply sticky behavior if we haven't reached the bottom of the page
      const shouldBeSticky = this.initialTop !== null && 
                            scrollY > (this.initialTop + this.sidebarHeight - viewportHeight) &&
                            scrollY < maxScroll;

      if (this.isSticky !== shouldBeSticky) {
        this.isSticky = shouldBeSticky;
        if (shouldBeSticky) {
          // Calculate where the bottom of the sidebar should be
          const bottomPosition = viewportHeight;
          const topPosition = bottomPosition - this.sidebarHeight;
          this.renderer.setStyle(this.elementRef.nativeElement, 'top', `${topPosition}px`);
        } else {
          this.renderer.removeStyle(this.elementRef.nativeElement, 'top');
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
    }, 0);

    window.addEventListener('scroll', this.scrollHandler, { passive: true });
    this.loadTrending();
    this.loadRecommendedUsers();
  }

  ngOnDestroy() {
    window.removeEventListener('scroll', this.scrollHandler);
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
        this.recommendedUsers = users;
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

  followUser(user: User, event: Event) {
    event.stopPropagation(); // Prevent navigation when clicking follow button
    this.userService.followUser(user.handle).subscribe({
      next: (updatedUser) => {
        // Update the user in the list
        const index = this.recommendedUsers.findIndex(u => u.handle === user.handle);
        if (index !== -1) {
          this.recommendedUsers[index] = updatedUser;
        }
      },
      error: (error) => {
        console.error('Error following user:', error);
      }
    });
  }
} 