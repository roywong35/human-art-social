import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError, Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

interface TokenResponse {
  access: string;
  refresh?: string;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
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
        return handleTokenRefresh(authService, req, next);
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
  authService: AuthService, 
  req: HttpRequest<unknown>, 
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> {
  return authService.refreshAccessToken().pipe(
    switchMap((response: TokenResponse) => {
      // Retry the original request with new token
      const newReq = addToken(req, response.access);
      return next(newReq);
    }),
    catchError(error => {
      // If refresh fails, logout user
      authService.logout();
      return throwError(() => error);
    })
  );
} 