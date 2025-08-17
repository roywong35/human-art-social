import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { User } from '../models/user.model';
import { UserService } from './user.service';

export interface OptimisticUpdate {
  user: User;
  action: 'follow' | 'unfollow';
  originalState: {
    is_following: boolean;
    followers_count: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class OptimisticUpdateService {
  private pendingUpdates = new Map<string, OptimisticUpdate>();

  constructor(private userService: UserService) {}

  // Apply optimistic follow update immediately
  followUserOptimistic(user: User): Observable<User> {
    // Store original state for rollback
    const originalState = {
      is_following: user.is_following || false,
      followers_count: user.followers_count || 0
    };

    // Apply optimistic update immediately
    const optimisticUser = {
      ...user,
      is_following: true,
      followers_count: (user.followers_count || 0) + 1
    };

    // Store the update for potential rollback
    this.pendingUpdates.set(user.handle, {
      user: optimisticUser,
      action: 'follow',
      originalState
    });

    // Make the API call
    return this.userService.followUser(user.handle).pipe(
      tap(() => {
        // Success - remove from pending updates
        this.pendingUpdates.delete(user.handle);
      }),
      catchError(error => {
        // Error - rollback the optimistic update
        this.rollbackUpdate(user.handle);
        return throwError(() => error);
      })
    );
  }

  // Apply optimistic unfollow update immediately
  unfollowUserOptimistic(user: User): Observable<User> {
    // Store original state for rollback
    const originalState = {
      is_following: user.is_following || false,
      followers_count: user.followers_count || 0
    };

    // Apply optimistic update immediately
    const optimisticUser = {
      ...user,
      is_following: false,
      followers_count: Math.max((user.followers_count || 0) - 1, 0)
    };

    // Store the update for potential rollback
    this.pendingUpdates.set(user.handle, {
      user: optimisticUser,
      action: 'unfollow',
      originalState
    });

    // Make the API call
    return this.userService.followUser(user.handle).pipe(
      tap(() => {
        // Success - remove from pending updates
        this.pendingUpdates.delete(user.handle);
      }),
      catchError(error => {
        // Error - rollback the optimistic update
        this.rollbackUpdate(user.handle);
        return throwError(() => error);
      })
    );
  }

  // Get optimistic user state (returns optimistic state if pending, original state otherwise)
  getOptimisticUser(user: User): User {
    const pendingUpdate = this.pendingUpdates.get(user.handle);
    if (pendingUpdate) {
      return pendingUpdate.user;
    }
    return user;
  }

  // Check if user has pending updates
  hasPendingUpdate(handle: string): boolean {
    return this.pendingUpdates.has(handle);
  }

  // Rollback a specific update
  private rollbackUpdate(handle: string): void {
    this.pendingUpdates.delete(handle);
  }

  // Get all pending updates (for debugging)
  getPendingUpdates(): Map<string, OptimisticUpdate> {
    return new Map(this.pendingUpdates);
  }
}
