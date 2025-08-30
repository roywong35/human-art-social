import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OfflineService } from '../../../services/offline.service';

@Component({
  selector: 'app-offline-indicator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './offline-indicator.component.html',
  styleUrls: ['./offline-indicator.component.scss']
})
export class OfflineIndicatorComponent {
  constructor(public offlineService: OfflineService) {}
}
