import { Component, Output, EventEmitter, HostListener, CUSTOM_ELEMENTS_SCHEMA, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { EmojiPickerService } from '../../../services/emoji-picker.service';

@Component({
  selector: 'app-emoji-picker',
  standalone: true,
  imports: [CommonModule, PickerComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div *ngIf="(emojiPickerService.showPicker$ | async)"
         class="emoji-picker-wrapper"
         [style.position]="'fixed'"
         [style.top.px]="(emojiPickerService.position$ | async)?.top"
         [style.left.px]="(emojiPickerService.position$ | async)?.left"
         [style.zIndex]="99999"
         (click)="$event.stopPropagation()">
      <emoji-mart
        class="emoji-mart"
        [style]="{ position: 'static', display: 'block' }"
        [title]="'Pick your emoji'"
        [set]="'twitter'"
        [enableSearch]="true"
        [showPreview]="false"
        [emojiSize]="20"
        [perLine]="8"
        (emojiSelect)="onEmojiSelect($event)">
      </emoji-mart>
    </div>
  `,
  styles: []
})
export class EmojiPickerComponent {
  @Output() emojiSelected = new EventEmitter<any>();

  constructor(public emojiPickerService: EmojiPickerService, private elementRef: ElementRef) {}

  @HostListener('document:click', ['$event'])
  handleClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    
    // Only handle clicks within this component
    if (!this.elementRef.nativeElement.contains(target)) {
      return;
    }
    
    console.log('EmojiPicker: Document click - target:', target);
    
    const isEmojiPicker = target.closest('.emoji-picker-wrapper') || 
                         target.closest('.emoji-mart') ||
                         target.closest('emoji-mart') ||
                         target.closest('.emoji-trigger');
    
    if (!isEmojiPicker) {
      this.emojiPickerService.hide();
    }
  }

  onEmojiSelect(event: any): void {
    this.emojiSelected.emit(event);
  }
} 