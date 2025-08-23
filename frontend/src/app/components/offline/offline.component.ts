import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-offline',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <div class="offline-container">
      <mat-card class="offline-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon class="offline-icon">wifi_off</mat-icon>
            You're Offline
          </mat-card-title>
          <mat-card-subtitle>
            But don't worry! You can still browse cached content
          </mat-card-subtitle>
        </mat-card-header>
        
        <mat-card-content>
          <p class="offline-message">
            While you're offline, you can:
          </p>
          <ul class="offline-features">
            <li>Browse previously loaded posts</li>
            <li>View your profile and settings</li>
            <li>Write draft posts (will sync when online)</li>
            <li>Navigate through cached pages</li>
          </ul>
          
          <div class="connection-status">
            <mat-icon class="status-icon">sync</mat-icon>
            <span>Checking for connection...</span>
          </div>
        </mat-card-content>
        
        <mat-card-actions>
          <button mat-raised-button color="primary" (click)="retryConnection()">
            <mat-icon>refresh</mat-icon>
            Try Again
          </button>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [`
    .offline-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    
    .offline-card {
      max-width: 500px;
      width: 100%;
      text-align: center;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }
    
    .offline-icon {
      font-size: 2rem;
      color: #ef4444;
      margin-right: 8px;
    }
    
    .offline-message {
      font-size: 1.1rem;
      margin: 20px 0;
      color: #374151;
    }
    
    .offline-features {
      text-align: left;
      margin: 20px 0;
      padding-left: 20px;
    }
    
    .offline-features li {
      margin: 10px 0;
      color: #6b7280;
    }
    
    .connection-status {
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 20px 0;
      padding: 15px;
      background: #f3f4f6;
      border-radius: 8px;
    }
    
    .status-icon {
      margin-right: 8px;
      color: #6366f1;
      animation: spin 2s linear infinite;
    }
    
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    mat-card-actions {
      display: flex;
      justify-content: center;
      padding: 20px;
    }
  `]
})
export class OfflineComponent implements OnInit {
  
  ngOnInit() {
    this.checkConnection();
  }
  
  checkConnection() {
    if (navigator.onLine) {
      // User is back online, redirect to main app
      window.location.reload();
    }
  }
  
  retryConnection() {
    this.checkConnection();
  }
}
