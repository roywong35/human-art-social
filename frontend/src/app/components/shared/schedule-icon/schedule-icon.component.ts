import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-schedule-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './schedule-icon.component.html',
  styleUrls: ['./schedule-icon.component.scss']
})
export class ScheduleIconComponent {
  @Input() disabled: boolean = false;
  @Input() isScheduled: boolean = false;
  @Input() size: number = 20;
  @Output() scheduleClick = new EventEmitter<void>();

  onScheduleClick() {
    if (!this.disabled) {
      this.scheduleClick.emit();
    }
  }
} 