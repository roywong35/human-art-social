import { Component, Input, Output, EventEmitter, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-repost-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './repost-menu.component.html',
  styleUrls: ['./repost-menu.component.scss']
})
export class RepostMenuComponent {
  @Input() isReposted = false;
  @Input() isAbove = false;
  @Output() optionSelected = new EventEmitter<'repost' | 'unrepost' | 'quote'>();
  @Output() closeMenu = new EventEmitter<void>();

  constructor(private elementRef: ElementRef) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.closeMenu.emit();
    }
  }

  onRepost() {
    this.optionSelected.emit(this.isReposted ? 'unrepost' : 'repost');
    this.closeMenu.emit();
  }

  onQuote() {
    this.optionSelected.emit('quote');
    this.closeMenu.emit();
  }
} 