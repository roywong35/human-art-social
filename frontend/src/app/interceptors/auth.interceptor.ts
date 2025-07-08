import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn, HttpEvent, HttpHeaders } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError, Observable } from 'rxjs';
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
      if (error.status === 401 && error.error?.code === 'token_not_valid') {
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

function handleTokenRefresh(
  router: Router,
  req: HttpRequest<unknown>, 
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> {
  const refreshToken = localStorage.getItem('refresh_token');
  
  if (!refreshToken) {
    // No refresh token, logout and redirect
    localStorage.clear();
    router.navigate(['/']);
    return throwError(() => new Error('No refresh token available'));
  }

  // Create a new HTTP request for token refresh
  const refreshRequest = new HttpRequest('POST', `${environment.apiUrl}/api/token/refresh/`, {
    refresh: refreshToken
  }, {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    })
  });

  return next(refreshRequest).pipe(
    switchMap((response: any) => {
      const tokenResponse = response.body as TokenResponse;
      if (tokenResponse?.access) {
        // Save new token
        localStorage.setItem('access_token', tokenResponse.access);
        
        // Retry the original request with new token
        const newReq = addToken(req, tokenResponse.access);
        return next(newReq);
      } else {
        throw new Error('Invalid token response');
      }
    }),
    catchError(error => {
      // If refresh fails, logout user
      localStorage.clear();
      router.navigate(['/']);
      return throwError(() => error);
    })
  );
} 