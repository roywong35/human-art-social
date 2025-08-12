import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
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

  getRecommendedUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/suggested/`).pipe(
      map(users => users.map(user => this.addImageUrls(user)!))
    );
  }

  getRecommendedUsersPaginated(page: number = 1): Observable<PaginatedResponse<User>> {
    return this.http.get<PaginatedResponse<User>>(`${this.apiUrl}/suggested/?page=${page}&page_size=20`).pipe(
      map(response => ({
        ...response,
        results: response.results.map(user => this.addImageUrls(user)!)
      }))
    );
  }

  updateProfile(handle: string, profileData: Partial<User> | FormData): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/handle/${handle}/`, profileData).pipe(
      map(user => this.addImageUrls(user)!)
    );
  }

  searchUsers(query: string): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/search/`, {
      params: { q: query }
    }).pipe(
      map(users => users.map(user => this.addImageUrls(user)!))
    );
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