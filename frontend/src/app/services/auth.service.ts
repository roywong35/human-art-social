import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, switchMap, throwError, map } from 'rxjs';
import { Router } from '@angular/router';
import { LoginCredentials, RegisterData, AuthResponse } from '../models';
import { User } from '../models/user.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private baseApiUrl = `${environment.apiUrl}/api`;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  
  // Public method to get current user value
  public getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }
  
  private tokenKey = 'token';

  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  
  // Proactive refresh management (Twitter/X style)
  private refreshTimer: any = null;
  private readonly REFRESH_BEFORE_EXPIRY = 5 * 60 * 1000; // Refresh 5 minutes before expiry

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.loadStoredAuth();

    // Try to load user from local storage
    const token = this.getToken();
    if (token) {
      this.loadUser().subscribe();
      // Only setup proactive refresh if we have a valid token
      if (this.accessToken) {
        this.setupProactiveRefresh(); // Start Twitter/X style token management
      }
    }
  }

  private loadStoredAuth(): void {
    const token = localStorage.getItem('access_token');
    const refresh = localStorage.getItem('refresh_token');
    const storedUser = localStorage.getItem('user');
    
    if (token && refresh && storedUser) {
      this.accessToken = token;
      this.refreshToken = refresh;
      const user = JSON.parse(storedUser);
      // Don't override the following_only_preference from the stored user data
      this.currentUserSubject.next(user);
    }
  }

  private processUserData(user: User): User {
    // Create a copy of the user object to avoid modifying the original
    const processedUser = { ...user };

    // Handle profile picture URL
    if (processedUser.profile_picture) {
      if (!processedUser.profile_picture.startsWith('http') && !processedUser.profile_picture.startsWith('data:')) {
        // Remove any leading slashes to avoid double slashes in the URL
        const cleanPath = processedUser.profile_picture.replace(/^\/+/, '');
        processedUser.profile_picture = `${this.apiUrl}/${cleanPath}`;
      }
    }

    // Handle banner image URL similarly
    if (processedUser.banner_image) {
      if (!processedUser.banner_image.startsWith('http') && !processedUser.banner_image.startsWith('data:')) {
        const cleanPath = processedUser.banner_image.replace(/^\/+/, '');
        processedUser.banner_image = `${this.apiUrl}/${cleanPath}`;
      }
    }

    // Ensure following_only_preference is explicitly set
    return {
      ...processedUser,
      following_only_preference: processedUser.following_only_preference ?? false
    };
  }

  private getAuthHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${this.accessToken}`
    });
  }

  private fetchUserProfile(): Observable<User> {
    if (!this.accessToken) {
      return throwError(() => new Error('No access token available'));
    }

    return this.http.get<User>(`${this.baseApiUrl}/users/me/`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(user => {
        const processedUser = this.processUserData(user);
        localStorage.setItem('user', JSON.stringify(processedUser));
        this.currentUserSubject.next(processedUser);
      }),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          this.logout();
        }
        return throwError(() => error);
      })
    );
  }

  login(credentials: LoginCredentials): Observable<any> {
    return this.http.post<{ access: string, refresh: string }>(`${this.baseApiUrl}/token/`, credentials).pipe(
      tap(response => {
        if (!response.access) {
          throw new Error('No access token in response');
        }
        this.accessToken = response.access;
        this.refreshToken = response.refresh;
        localStorage.setItem('access_token', response.access);
        localStorage.setItem('refresh_token', response.refresh);
      }),
      switchMap(() => this.fetchUserProfile()),
      tap(user => {
        const processedUser = this.processUserData(user);
        this.currentUserSubject.next(processedUser);
        
        // Start Twitter/X style token management
        this.setupProactiveRefresh();
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('Login error:', error);
        this.logout();
        return throwError(() => error);
      })
    );
  }

  register(userData: RegisterData): Observable<User> {
    return this.http.post<AuthResponse>(`${this.baseApiUrl}/users/`, userData).pipe(
      tap(response => {
        if (response.access) {
          this.accessToken = response.access;
          this.refreshToken = response.refresh;
          localStorage.setItem('access_token', response.access);
          localStorage.setItem('refresh_token', response.refresh);
        }
      }),
      switchMap(() => this.fetchUserProfile()),
      catchError((error: HttpErrorResponse) => {
        this.logout();
        return throwError(() => error);
      })
    );
  }



  refreshAccessToken(): Observable<{ access: string }> {
    if (!this.refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http.post<{ access: string }>(`${this.baseApiUrl}/token/refresh/`, {
      refresh: this.refreshToken
    }).pipe(
      tap(response => {
        this.accessToken = response.access;
        localStorage.setItem('access_token', response.access);
        
        // Setup next proactive refresh
        this.setupProactiveRefresh();
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('Token refresh failed:', error);
        this.logout();
        return throwError(() => error);
      })
    );
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  isAdmin(): boolean {
    const currentUser = this.currentUserSubject.getValue();
    return currentUser?.is_staff === true;
  }

  updateFollowingOnlyPreference(value: boolean): Observable<User> {
    return this.http.patch<User>(`${this.baseApiUrl}/users/me/`, {
      following_only_preference: value
    }).pipe(
      tap(user => {
        const currentUser = this.currentUserSubject.value;
        if (currentUser) {
          const updatedUser = { ...currentUser, following_only_preference: value };
          this.currentUserSubject.next(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
          localStorage.setItem('following_only_preference', value.toString());
        }
      })
    );
  }

  getToken(): string | null {
    return this.getAccessToken();
  }

  loadUser(): Observable<void> {
    return this.fetchUserProfile().pipe(
      map(() => void 0)
    );
  }

  // ============ TWITTER/X STYLE TOKEN MANAGEMENT ============

  /**
   * Decode JWT token to extract expiry time
   */
  private decodeToken(token: string): any {
    if (!token) {
      console.warn('decodeToken called with null/undefined token');
      return null;
    }
    
    try {
      const payload = token.split('.')[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch (error) {
      console.error('Failed to decode token:', error);
      return null;
    }
  }

  /**
   * Setup proactive token refresh (refreshes before expiry like Twitter/X)
   */
  private setupProactiveRefresh(): void {
    if (!this.accessToken) return;

    // Clear existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    const tokenData = this.decodeToken(this.accessToken);
    if (!tokenData || !tokenData.exp) {
      // Fallback: refresh every 15 minutes if no expiry info
      this.scheduleRefresh(15 * 60 * 1000);
      return;
    }

    const expiry = tokenData.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const timeUntilExpiry = expiry - now;
    const refreshTime = timeUntilExpiry - this.REFRESH_BEFORE_EXPIRY;

    if (refreshTime > 0) {
      this.scheduleRefresh(refreshTime);
    } else {
      // Token expires soon, refresh immediately
      this.refreshAccessToken().subscribe({
        next: () => console.log('✅ Immediate token refresh successful'),
        error: (error) => console.error('❌ Immediate token refresh failed:', error)
      });
    }
  }

  /**
   * Schedule token refresh
   */
  private scheduleRefresh(delay: number): void {
    this.refreshTimer = setTimeout(() => {
      this.refreshAccessToken().subscribe({
        next: () => {
          this.setupProactiveRefresh(); // Schedule next refresh
        },
        error: (error) => {
          console.error('❌ Proactive token refresh failed:', error);
          // Don't schedule another refresh if this one failed
        }
      });
    }, delay);
  }



  /**
   * Enhanced logout that clears all timers
   */
  logout(): void {
    
    // Clear proactive refresh timers
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    
    this.currentUserSubject.next(null);
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('following_only_preference');
    
    // Clear dark mode preference and update UI
    localStorage.removeItem('darkMode');
    document.documentElement.classList.remove('dark');
    
    this.router.navigate(['/']);
  }
} 