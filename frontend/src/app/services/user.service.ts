import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { User } from '../models/user.model';

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