import { Component, ElementRef, OnInit, OnDestroy, HostBinding, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SearchBarComponent } from '../search-bar/search-bar.component';
import { HashtagService, HashtagResult } from '../../services/hashtag.service';
import { Router } from '@angular/router';

interface TrendingTopic {
  name: string;
  postCount: number;
  category: string;
}

interface RecommendedUser {
  name: string;
  username: string;
  avatar: string;
  bio: string;
}

@Component({
  selector: 'app-right-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchBarComponent],
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
  readonly maxTrendingTopics = 6;

  get placeholderCount(): number {
    return Math.max(0, this.maxTrendingTopics - this.trendingTopics.length);
  }

  get placeholderArray(): number[] {
    return Array(this.placeholderCount).fill(0);
  }

  trendingTopicsOriginal: TrendingTopic[] = [
    { name: 'Angular', postCount: 125000, category: 'Technology' },
    { name: 'TypeScript', postCount: 98000, category: 'Programming' },
    { name: 'WebDev', postCount: 85000, category: 'Technology' },
    { name: 'AI', postCount: 250000, category: 'Technology' },
    { name: 'Python', postCount: 180000, category: 'Programming' }
  ];

  recommendedUsers: RecommendedUser[] = [
    {
      name: 'John Developer',
      username: '@johndeveloper',
      avatar: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=',
      bio: 'Full-stack developer | Angular enthusiast'
    },
    {
      name: 'Sarah Coder',
      username: '@sarahcodes',
      avatar: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=',
      bio: 'Frontend Developer | UI/UX Designer'
    },
    {
      name: 'Tech Ninja',
      username: '@techninja',
      avatar: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=',
      bio: 'Software Engineer | Open Source Contributor'
    }
  ];

  private scrollHandler: () => void;

  constructor(
    private elementRef: ElementRef,
    private renderer: Renderer2,
    private hashtagService: HashtagService,
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
} 