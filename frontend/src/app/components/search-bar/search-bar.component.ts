import { Component, OnInit, OnDestroy, ViewChild, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, forkJoin, of } from 'rxjs';
import { UserService } from '../../services/user.service';
import { HashtagService, HashtagResult } from '../../services/hashtag.service';
import { User } from '../../models/user.model';
import { environment } from '../../../environments/environment';

interface SearchResult {
  type: 'user' | 'hashtag';
  data: User | HashtagResult;
}

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search-bar.component.html',
  styleUrls: ['./search-bar.component.scss']
})
export class SearchBarComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('searchInput') searchInput!: ElementRef;
  @Input() initialSearchValue: string = '';
  @Input() isPreview = false;
  
  searchQuery = '';
  results: SearchResult[] = [];
  isLoading = false;
  showResults = false;
  noResults = false;
  
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();
  
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  constructor(
    private userService: UserService,
    private hashtagService: HashtagService,
    private router: Router
  ) {}

  ngOnInit() {
    // Setup search with debounce
    this.searchSubject.pipe(
      takeUntil(this.destroy$),
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      this.performSearch(query);
    });

    // Set initial search value if provided
    if (this.initialSearchValue) {
      this.searchQuery = this.initialSearchValue;
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['initialSearchValue'] && changes['initialSearchValue'].currentValue) {
      this.searchQuery = changes['initialSearchValue'].currentValue;
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchInput(event: any) {
    this.searchSubject.next(this.searchQuery);
  }

  onFocus() {
    this.showResults = true;
  }

  onBlur() {
    // Delay hiding results to allow for click events
    setTimeout(() => {
      this.showResults = false;
    }, 200);
  }

  navigateToResult(result: SearchResult) {
    if (result.type === 'user') {
      const user = result.data as User;
      this.router.navigate(['/', user.handle]);
    } else {
      const hashtag = result.data as HashtagResult;
      // Navigate to hashtag search results page (you'll need to implement this)
      this.router.navigate(['/search'], { queryParams: { q: `#${hashtag.name}` } });
    }
    this.showResults = false;
    this.searchQuery = '';
    this.results = [];
  }

  getProfilePicture(user: User): string {
    if (!user.profile_picture) {
      return this.defaultAvatar;
    }
    return user.profile_picture.startsWith('http') 
      ? user.profile_picture 
      : `${environment.apiUrl}${user.profile_picture}`;
  }

  private performSearch(query: string) {
    if (!query.trim()) {
      this.results = [];
      this.noResults = false;
      return;
    }

    this.isLoading = true;
    this.noResults = false;

    if (query.startsWith('#')) {
      // Hashtag search
      this.hashtagService.searchHashtags(query).subscribe({
        next: (response) => {
          this.results = response.results.map(hashtag => ({
            type: 'hashtag',
            data: hashtag
          }));
          this.isLoading = false;
          this.noResults = this.results.length === 0;
        },
        error: () => {
          this.isLoading = false;
          this.noResults = true;
          this.results = [];
        }
      });
    } else {
      // User search
      const searchQuery = query.startsWith('@') ? query.substring(1) : query;
      this.userService.searchUsers(searchQuery).subscribe({
        next: (users: User[]) => {
          this.results = users.map(user => ({
            type: 'user',
            data: user
          }));
          this.isLoading = false;
          this.noResults = this.results.length === 0;
        },
        error: () => {
          this.isLoading = false;
          this.noResults = true;
          this.results = [];
        }
      });
    }
  }
} 