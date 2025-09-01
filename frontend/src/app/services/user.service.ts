import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { User } from '../models/user.model';

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = `${environment.apiUrl}/api/users`;

  // Cache for recommended users
  private recommendedUsersCache: {
    users: User[];
    timestamp: number;
  } | null = null;

  constructor(private http: HttpClient) {}

  getUserById(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}/`).pipe(
      map(user => this.addImageUrls(user)!)
    );
  }

  getUserByHandle(handle: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/handle/${handle}/`).pipe(
      map(user => this.addImageUrls(user)!)
    );
  }

  followUser(handle: string): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/handle/${handle}/follow/`, {}).pipe(
      map(user => this.addImageUrls(user)!)
    );
  }

  // Optimistic follow with rollback on error
  followUserOptimistic(handle: string, user: User): Observable<User> {
    // Optimistically update the user object
    const optimisticUser = { ...user, is_following: true, followers_count: (user.followers_count || 0) + 1 };
    
    return this.http.post<User>(`${this.apiUrl}/handle/${handle}/follow/`, {}).pipe(
      map(response => this.addImageUrls(response)!),
      catchError(error => {
        // Rollback optimistic update on error
        console.error('Follow failed, rolling back optimistic update:', error);
        return throwError(() => error);
      })
    );
  }

  // Optimistic unfollow with rollback on error
  unfollowUserOptimistic(handle: string, user: User): Observable<User> {
    // Optimistically update the user object
    const optimisticUser = { ...user, is_following: false, followers_count: Math.max((user.followers_count || 0) - 1, 0) };
    
    return this.http.post<User>(`${this.apiUrl}/handle/${handle}/follow/`, {}).pipe(
      map(response => this.addImageUrls(response)!),
      catchError(error => {
        // Rollback optimistic update on error
        console.error('Unfollow failed, rolling back optimistic update:', error);
        return throwError(() => error);
      })
    );
  }

  getRecommendedUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/suggested/`).pipe(
      map(users => users.map(user => this.addImageUrls(user)!))
    );
  }

  getRecommendedUsersPaginated(page: number = 1): Observable<PaginatedResponse<User>> {
    // Check if we have valid cached data for first page
    if (page === 1 && this.isRecommendedUsersCacheValid()) {
      return of({
        count: this.recommendedUsersCache!.users.length,
        next: null,
        previous: null,
        results: this.recommendedUsersCache!.users
      });
    }

    return this.http.get<PaginatedResponse<User>>(`${this.apiUrl}/suggested/?page=${page}&page_size=20`).pipe(
      map(response => ({
        ...response,
        results: response.results.map(user => this.addImageUrls(user)!)
      })),
      tap(response => {
        // Cache the first page results
        if (page === 1) {
          this.cacheRecommendedUsers(response.results);
        }
      })
    );
  }

  updateProfile(handle: string, profileData: Partial<User> | FormData): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/handle/${handle}/`, profileData).pipe(
      map(user => this.addImageUrls(user)!)
    );
  }

  searchUsers(query: string, page: number = 1): Observable<PaginatedResponse<User>> {
    return this.http.get<PaginatedResponse<User>>(`${this.apiUrl}/search/`, {
      params: { q: query, page: page.toString() }
    }).pipe(
      map(response => ({
        ...response,
        results: response.results.map(user => this.addImageUrls(user)!)
      }))
    );
  }

  /**
   * Cache recommended users data
   */
  private cacheRecommendedUsers(users: User[]): void {
    this.recommendedUsersCache = {
      users: [...users],
      timestamp: Date.now()
    };
  }

  /**
   * Check if recommended users cache is still valid (less than 10 minutes old)
   */
  private isRecommendedUsersCacheValid(): boolean {
    if (!this.recommendedUsersCache) return false;
    
    const cacheAge = Date.now() - this.recommendedUsersCache.timestamp;
    const maxAge = 10 * 60 * 1000; // 10 minutes
    return cacheAge < maxAge;
  }

  /**
   * Clear recommended users cache
   */
  public clearRecommendedUsersCache(): void {
    this.recommendedUsersCache = null;
  }

  /**
   * Check if recommended users have cached content
   */
  public hasCachedRecommendedUsers(): boolean {
    return this.isRecommendedUsersCacheValid();
  }

  getUserFollowers(handle: string): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/handle/${handle}/followers/`).pipe(
      map(users => users.map(user => this.addImageUrls(user)!))
    );
  }

  getUserFollowing(handle: string): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/handle/${handle}/following/`).pipe(
      map(users => users.map(user => this.addImageUrls(user)!))
    );
  }

  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/all/`).pipe(
      map(users => users.map(user => this.addImageUrls(user)!))
    );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/users/change-password/`, {
      current_password: currentPassword,
      new_password: newPassword
    });
  }

  private addImageUrls(user: User | null): User | null {
    if (!user) return null;
    
    if (user.profile_picture && !user.profile_picture.startsWith('http')) {
      user.profile_picture = `${environment.apiUrl}${user.profile_picture}`;
    }
    if (user.banner_image && !user.banner_image.startsWith('http')) {
      user.banner_image = `${environment.apiUrl}${user.banner_image}`;
    }
    return user;
  }
} 