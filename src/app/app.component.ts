import {Component, ComponentFactoryResolver, OnInit, ViewChild} from '@angular/core';
import {GreetingComponent} from './greeting/greeting.component';
import {RefDirective} from './shared/ref.directive';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit{

  @ViewChild(RefDirective, {static: true}) refDir: RefDirective;

  constructor(private resolver: ComponentFactoryResolver) {
  }
  ngOnInit(): void {
    this.showGreeting();
  }

  private showGreeting() {
    const modalFactory = this.resolver.resolveComponentFactory(GreetingComponent);
    this.refDir.containerRef.clear();
    const greetingComponent = this.refDir.containerRef.createComponent(modalFactory);
    greetingComponent.instance.close.subscribe(() => {
      this.refDir.containerRef.clear();
    });

  }
}
