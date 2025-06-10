import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { NotificationService } from '../services/notification.service';
import { AuthService } from '../services/auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const notificationService = inject(NotificationService);
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'An unexpected error occurred';

      // Don't show error notifications for auth endpoints
      const isAuthEndpoint = req.url.includes('/token/') || req.url.includes('/users/');
      
      if (error.status === 0) {
        errorMessage = 'Unable to connect to the server. Please check your internet connection.';
      } else if (error.status === 401) {
        if (!isAuthEndpoint) {
          authService.logout();
          router.navigate(['/login']);
          errorMessage = 'Your session has expired. Please log in again.';
        }
      } else if (error.status === 403) {
        errorMessage = 'You do not have permission to perform this action.';
      } else if (error.status === 404) {
        errorMessage = 'The requested resource was not found.';
      } else if (error.status === 400 && error.error) {
        if (typeof error.error === 'object') {
          const errors = Object.entries(error.error)
            .map(([field, messages]) => `${field}: ${messages}`)
            .join(', ');
          errorMessage = errors;
        } else {
          errorMessage = error.error.message || error.error;
        }
      }

      // Only show notification for non-auth endpoints
      if (!isAuthEndpoint) {
        notificationService.showError(errorMessage);
      }

      return throwError(() => error);
    })
  );
}; 