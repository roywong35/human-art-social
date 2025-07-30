import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AppealStatus {
  can_appeal: boolean;
  appeal?: {
    id: number;
    appeal_text: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    reviewed_at?: string;
    reviewer?: {
      id: number;
      username: string;
    };
    evidence_files: {
      id: number;
      filename: string;
      file_type: string;
      file_size: number;
      file_url: string;
    }[];
  };
  message: string;
}

export interface PostAppeal {
  id: number;
  post: {
    id: number;
    content: string;
    author: {
      id: number;
      username: string;
      handle: string;
    };
  };
  appeal_text: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at?: string;
  reviewer?: {
    id: number;
    username: string;
  };
  evidence_files: {
    id: number;
    filename: string;
    file_type: string;
    file_size: number;
    file_url: string;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class AppealService {
  private baseUrl = `${environment.apiUrl}/api/moderation/posts`;

  constructor(private http: HttpClient) {}

  submitAppeal(handle: string, postId: number, appealText: string, evidenceFiles: File[]): Observable<any> {
    const formData = new FormData();
    formData.append('appeal_text', appealText);
    
    evidenceFiles.forEach(file => {
      formData.append('evidence_files', file);
    });

    return this.http.post(`${this.baseUrl}/${handle}/${postId}/appeal/`, formData);
  }

  getAppealStatus(handle: string, postId: number): Observable<AppealStatus> {
    return this.http.get<AppealStatus>(`${this.baseUrl}/${handle}/${postId}/appeal-status/`);
  }

  getMyAppeals(page: number = 1): Observable<{ results: PostAppeal[], count: number }> {
    return this.http.get<{ results: PostAppeal[], count: number }>(`${this.baseUrl}/my-appeals/?page=${page}`);
  }
} 