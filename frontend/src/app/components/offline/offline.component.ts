import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-offline',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  templateUrl: './offline.component.html',
  styleUrls: ['./offline.component.scss']
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
