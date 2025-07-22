import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn, HttpEvent, HttpHeaders } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError, Observable, BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

interface TokenResponse {
  access: string;
  refresh?: string;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = localStorage.getItem('access_token');
  
  // Skip token for public endpoints
  if (req.url.includes('token/refresh/') || 
      req.url.includes('/posts/public/') ||
      req.url.includes('/login') ||
      req.url.includes('/register')) {
    return next(req);
  }

  if (token) {
    req = addToken(req, token);
  }
  
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Handle ALL 401 errors with token refresh (not just 'token_not_valid')
      if (error.status === 401) {

        return handleTokenRefresh(router, req, next);
      }
      return throwError(() => error);
    })
  );
};

function addToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({
    headers: req.headers.set('Authorization', `Bearer ${token}`)
  });
}

// Track ongoing refresh to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshTokenSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

function handleTokenRefresh(
  router: Router,
  req: HttpRequest<unknown>, 
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> {
  const refreshToken = localStorage.getItem('refresh_token');
  
  if (!refreshToken) {

    performLogout(router);
    return throwError(() => new Error('No refresh token available'));
  }

  // If already refreshing, wait for the result
  if (isRefreshing) {

    return refreshTokenSubject.pipe(
      switchMap(token => {
        if (token) {

          const newReq = addToken(req, token);
          return next(newReq);
        } else {

          return throwError(() => new Error('Token refresh failed'));
        }
      })
    );
  }

  // Start refresh process

  isRefreshing = true;
  refreshTokenSubject.next(null);

  // Create a new HTTP request for token refresh
  const refreshRequest = new HttpRequest('POST', `${environment.apiUrl}/api/token/refresh/`, 
    { refresh: refreshToken }, 
    {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    }
  );

  return next(refreshRequest).pipe(
    switchMap((response: any) => {
      const tokenResponse = response.body as TokenResponse;
      if (tokenResponse?.access) {

        
        // Save new token
        localStorage.setItem('access_token', tokenResponse.access);
        
        // Update refresh subject and reset flag
        isRefreshing = false;
        refreshTokenSubject.next(tokenResponse.access);
        
        // Retry the original request with new token
        const newReq = addToken(req, tokenResponse.access);
        return next(newReq);
      } else {
        throw new Error('Invalid token response - no access token received');
      }
    }),
    catchError(error => {

      
      // Reset refresh state
      isRefreshing = false;
      refreshTokenSubject.next(null);
      
      // If refresh fails, logout user
      performLogout(router);
      return throwError(() => error);
    })
  );
}

function performLogout(router: Router): void {

  localStorage.clear();
  
  // Navigate to home page
  router.navigate(['/']);
  
  // Optionally show a message (but we're skipping notifications as requested)

} 