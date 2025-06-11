import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { UserService } from '../../services/user.service';
import { User } from '../../models/user.model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search-bar.component.html',
  styleUrls: ['./search-bar.component.scss']
})
export class SearchBarComponent implements OnInit, OnDestroy {
  @ViewChild('searchInput') searchInput!: ElementRef;
  
  searchQuery = '';
  results: User[] = [];
  isLoading = false;
  showResults = false;
  noResults = false;
  
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();
  
  protected defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  constructor(
    private userService: UserService,
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
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onFocus() {
    this.showResults = true;
    if (this.searchQuery) {
      this.performSearch(this.searchQuery);
    }
  }

  onBlur() {
    // Delay hiding results to allow for click events
    setTimeout(() => {
      this.showResults = false;
    }, 200);
  }

  onSearchInput(event: Event) {
    const query = (event.target as HTMLInputElement).value;
    this.searchQuery = query;
    this.searchSubject.next(query);
  }

  navigateToProfile(user: User) {
    this.router.navigate(['/', user.handle]);
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

    // Remove @ symbol if present for the API call
    const searchQuery = query.startsWith('@') ? query.substring(1) : query;

    this.userService.searchUsers(searchQuery).subscribe({
      next: (users: User[]) => {
        // Filter results based on whether it's a handle search or username search
        if (query.startsWith('@')) {
          this.results = users.filter(user => 
            user.handle.toLowerCase().includes(searchQuery.toLowerCase())
          );
        } else {
          this.results = users.filter(user => 
            user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (user.display_name && user.display_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
            user.handle.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }
        
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