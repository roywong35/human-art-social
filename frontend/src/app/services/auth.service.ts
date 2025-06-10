import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, switchMap, throwError } from 'rxjs';
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

  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.loadStoredAuth();
    console.log('Auth Service initialized with API URL:', this.baseApiUrl);
  }

  private loadStoredAuth() {
    try {
      const storedUser = localStorage.getItem('user');
      const storedAccessToken = localStorage.getItem('access_token');
      const storedRefreshToken = localStorage.getItem('refresh_token');

      console.log('Stored auth data:', {
        user: storedUser ? JSON.parse(storedUser) : null,
        accessToken: storedAccessToken ? 'exists' : 'null',
        refreshToken: storedRefreshToken ? 'exists' : 'null'
      });

      if (storedAccessToken) {
        this.accessToken = storedAccessToken;
        this.refreshToken = storedRefreshToken;
        
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          this.currentUserSubject.next(this.processUserData(parsedUser));
        } else {
          // If we have a token but no user, try to fetch the user
          this.fetchUserProfile().subscribe();
        }
      }
    } catch (error) {
      console.error('Error loading stored auth data:', error);
      this.logout();
    }
  }

  private processUserData(user: User): User {
    if (user.profile_picture && !user.profile_picture.startsWith('http')) {
      user.profile_picture = `${this.apiUrl}${user.profile_picture}`;
    }
    if (user.banner_image && !user.banner_image.startsWith('http')) {
      user.banner_image = `${this.apiUrl}${user.banner_image}`;
    }
    return user;
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

  login(credentials: LoginCredentials): Observable<User> {
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

  logout() {
    console.log('Logging out, clearing auth data');
    this.currentUserSubject.next(null);
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    this.router.navigate(['/login']);
  }

  refreshAccessToken(): Observable<{ access: string }> {
    if (!this.refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http.post<{ access: string }>(`${this.baseApiUrl}/token/refresh/`, {
      refresh: this.refreshToken
    }).pipe(
      tap(response => {
        console.log('Token refresh successful');
        this.accessToken = response.access;
        localStorage.setItem('access_token', response.access);
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
} 