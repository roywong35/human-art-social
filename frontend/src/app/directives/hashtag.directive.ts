import { Directive, ElementRef, Input, OnInit, Renderer2, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';

@Directive({
  selector: '[appHashtag]',
  standalone: true
})
export class HashtagDirective implements OnInit, OnDestroy {
  @Input() content: string = '';
  @Input() preventClick: boolean = false; // To prevent clicks when in preview mode

  private hashtagRegex = /#[\w\u3040-\u309F\u30A0-\u30FF]+/g;

  constructor(
    private el: ElementRef,
    private renderer: Renderer2,
    private router: Router
  ) {}

  ngOnInit() {
    this.renderHashtags();
  }

  ngOnDestroy() {
    // Clean up any event listeners if needed
  }

  private renderHashtags() {
    if (!this.content) return;

    // Clear existing content
    this.el.nativeElement.innerHTML = '';

    // Split content by hashtags
    const parts = this.content.split(this.hashtagRegex);
    const hashtags = this.content.match(this.hashtagRegex) || [];

    // Build safe DOM structure
    parts.forEach((part, index) => {
      // Add text part
      if (part) {
        const textNode = this.renderer.createText(part);
        this.renderer.appendChild(this.el.nativeElement, textNode);
      }

      // Add hashtag link if exists
      if (hashtags[index]) {
        const hashtag = hashtags[index];
        const link = this.renderer.createElement('a');
        
        // Set text content (safe)
        this.renderer.setProperty(link, 'textContent', hashtag);
        
        // Add classes
        this.renderer.addClass(link, 'hashtag');
        this.renderer.addClass(link, 'text-blue-500');
        this.renderer.addClass(link, 'hover:text-blue-600');
        this.renderer.addClass(link, 'hover:underline');
        this.renderer.addClass(link, 'cursor-pointer');
        this.renderer.addClass(link, 'transition-colors');
        
        // Add click handler
        if (!this.preventClick) {
          this.renderer.listen(link, 'click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.onHashtagClick(hashtag);
          });
        }
        
        this.renderer.appendChild(this.el.nativeElement, link);
      }
    });
  }

  private onHashtagClick(hashtag: string) {
    // Remove the # symbol for the search query
    const searchTerm = hashtag.substring(1);
    this.router.navigate(['/search'], { queryParams: { q: hashtag } });
  }
} 