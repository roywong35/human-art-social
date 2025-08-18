import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { User } from '../models/user.model';
import { UserService } from './user.service';
import { AuthService } from './auth.service';

export interface OptimisticUpdate {
  user: User;
  action: 'follow' | 'unfollow';
  originalState: {
    is_following: boolean;
    followers_count: number;
  };
}

export interface FollowStatusChange {
  userHandle: string;
  isFollowing: boolean;
  followersCount: number;
}

export interface FollowingCountChange {
  currentUserHandle: string;
  followingCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class OptimisticUpdateService {
  private pendingUpdates = new Map<string, OptimisticUpdate>();
  
  // BehaviorSubject to track follow status changes for real-time sync
  private followStatusChanges$ = new BehaviorSubject<FollowStatusChange | null>(null);
  
  // BehaviorSubject to track following count changes for the current user
  private followingCountChanges$ = new BehaviorSubject<FollowingCountChange | null>(null);

  constructor(
    private userService: UserService,
    private authService: AuthService
  ) {}

  // Observable that components can subscribe to for follow status changes
  get followStatusChanges(): Observable<FollowStatusChange | null> {
    return this.followStatusChanges$.asObservable();
  }

  // Observable that components can subscribe to for following count changes
  get followingCountChanges(): Observable<FollowingCountChange | null> {
    return this.followingCountChanges$.asObservable();
  }

  // Method to notify components of follow status changes
  private notifyFollowStatusChange(user: User, isFollowing: boolean): void {
    const change: FollowStatusChange = {
      userHandle: user.handle,
      isFollowing: isFollowing,
      followersCount: user.followers_count || 0
    };
    this.followStatusChanges$.next(change);
  }

  // Method to notify components of following count changes
  private notifyFollowingCountChange(currentUserHandle: string, followingCount: number): void {
    const change: FollowingCountChange = {
      currentUserHandle: currentUserHandle,
      followingCount: followingCount
    };
    this.followingCountChanges$.next(change);
  }

  // Apply optimistic follow update immediately
  followUserOptimistic(user: User): Observable<User> {
    // Store original state for rollback
    const originalState = {
      is_following: user.is_following || false,
      followers_count: user.followers_count || 0
    };

    // Create optimistic user state
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

    // Notify components of the optimistic change (ONLY ONCE)
    // Use the user's CURRENT state since the modal may have already updated it
    this.notifyFollowStatusChange(user, true);

    // Get current user to update their following count
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      const newFollowingCount = (currentUser.following_count || 0) + 1;
      this.notifyFollowingCountChange(currentUser.handle, newFollowingCount);
    }

    // Make the API call
    return this.userService.followUser(user.handle).pipe(
      tap(() => {
        // Success - remove from pending updates
        this.pendingUpdates.delete(user.handle);
        // DON'T notify again - the optimistic update already notified
      }),
      catchError(error => {
        // Error - rollback the optimistic update
        this.rollbackUpdate(user.handle);
        // Notify components to revert the change
        this.notifyFollowStatusChange(user, false);
        
        // Revert following count change
        if (currentUser) {
          const revertedFollowingCount = (currentUser.following_count || 0);
          this.notifyFollowingCountChange(currentUser.handle, revertedFollowingCount);
        }
        
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

    // Notify components of the optimistic change (ONLY ONCE)
    // Use the user's CURRENT state since the modal may have already updated it
    this.notifyFollowStatusChange(user, false);

    // Get current user to update their following count
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      const newFollowingCount = Math.max((currentUser.following_count || 0) - 1, 0);
      this.notifyFollowingCountChange(currentUser.handle, newFollowingCount);
    }

    // Make the API call - use the same endpoint as follow since backend handles both
    return this.userService.followUser(user.handle).pipe(
      tap(() => {
        // Success - remove from pending updates
        this.pendingUpdates.delete(user.handle);
        // DON'T notify again - the optimistic update already notified
      }),
      catchError(error => {
        // Error - rollback the optimistic update
        this.rollbackUpdate(user.handle);
        // Notify components to revert the change
        this.notifyFollowStatusChange(user, true);
        
        // Revert following count change
        if (currentUser) {
          const revertedFollowingCount = (currentUser.following_count || 0);
          this.notifyFollowingCountChange(currentUser.handle, revertedFollowingCount);
        }
        
        return throwError(() => error);
      })
    );
  }

  // Get optimistic user state for follow action
  getOptimisticUserForFollow(user: User): User {
    return {
      ...user,
      is_following: true,
      followers_count: (user.followers_count || 0) + 1
    };
  }

  // Get optimistic user state for unfollow action
  getOptimisticUserForUnfollow(user: User): User {
    return {
      ...user,
      is_following: false,
      followers_count: Math.max((user.followers_count || 0) - 1, 0)
    };
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
