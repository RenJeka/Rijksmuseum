import {
  Directive,
  ElementRef,
  HostListener,
  Input,
  Renderer2
} from '@angular/core';

/**
 * The directive displays a large image (over the entire parent container), adding a background and blurring the background
 * To display an image, you must pass the url of the image as a parameter (value) of the directive
 */

@Directive({
  selector: '[imageScale]'
})
export class ImageScaleDirective {

  @Input('imageScale') passedImageUrl: string;
  private bigImage: HTMLDivElement = this.renderer.createElement('div');
  private bigImageContainer: HTMLDivElement = this.renderer.createElement('div');
  private bigImageOverlay: HTMLDivElement = this.renderer.createElement('div');
  private imageUrl: string;

  constructor(
    private elRef: ElementRef,
    private renderer: Renderer2,
  ) {
    this.renderer.setStyle(this.elRef.nativeElement, 'cursor', 'zoom-in');
    this.renderer.addClass(this.bigImageOverlay, 'overlay-big-image');
    this.renderer.addClass(this.bigImage, 'bigImage');
    this.renderer.appendChild(this.bigImageContainer, this.bigImageOverlay);
    this.renderer.appendChild(this.bigImageOverlay, this.bigImage);
    this.renderer.appendChild(this.elRef.nativeElement, this.bigImageContainer);
    this.renderer.addClass(this.bigImageContainer, 'inactive');
  }

  @HostListener('click', ['$event'])
  onClick(event: Event) {
    this.imageUrl = this.getImageUrl();

    if (this.imageUrl) {
      this.renderer.setStyle(this.bigImage, 'background-image', `url('${this.imageUrl}')`);
    } else {
      this.renderer.addClass(this.bigImage, 'not-found');
    }

    this.bigImageContainer.classList.toggle('inactive');
  }

  getImageUrl(): string | null {
    if (this.passedImageUrl) {
      return this.passedImageUrl;
    } else if (this.elRef.nativeElement.style.backgroundImage) {
      return  this.elRef.nativeElement.style.backgroundImage.slice(5, -2);
    } else {
      console.error(new Error('No URL found to use directive \'imageScale\'. Check the \'backgroundImage\' styles or pass the URL as a parameter to the \'imageScale\' directive'));
      return null;
    }
  }
}
