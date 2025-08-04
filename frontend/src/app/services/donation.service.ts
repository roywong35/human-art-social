import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Donation, CreateDonationRequest } from '../models/donation.model';

@Injectable({
  providedIn: 'root'
})
export class DonationService {
  private baseUrl = `${environment.apiUrl}/api/posts`;

  constructor(private http: HttpClient) {}

  getPostDonations(postId: number): Observable<Donation[]> {
    return this.http.get<Donation[]>(`${this.baseUrl}/${postId}/donations/`);
  }

  createDonation(donation: CreateDonationRequest): Observable<Donation> {
    return this.http.post<Donation>(`${this.baseUrl}/${donation.post}/donate/`, donation);
  }

  getUserDonations(userId: number): Observable<Donation[]> {
    return this.http.get<Donation[]>(`${this.baseUrl}/user/${userId}/donations/`);
  }
}