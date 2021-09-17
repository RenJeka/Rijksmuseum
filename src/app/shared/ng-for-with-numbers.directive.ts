import {
  Directive,
  Input,
  TemplateRef,
  ViewContainerRef
} from '@angular/core';

/**
 * The directive works exactly the same as "* ngFor", only the number of elements can be passed as a prime number (as an argument
 * directives). Those. the directive displays as many elements as the number passed in the parameter.
 */
@Directive({
  selector: '[ngForWithNumbers]'
})
export class NgForWithNumbersDirective {

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef) { }

  @Input('ngForWithNumbers') set duplicateElements(numberOfDuplicates: number) {
    this.viewContainer.clear();
    for (let i = 0; i < numberOfDuplicates; i++) {
      this.viewContainer.createEmbeddedView(this.templateRef);
    }
  }
}
