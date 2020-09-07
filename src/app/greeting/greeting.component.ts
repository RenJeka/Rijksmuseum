import {Component, EventEmitter, OnInit, Output} from '@angular/core';

@Component({
  selector: 'app-greeting',
  templateUrl: './greeting.component.html',
  styleUrls: ['./greeting.component.scss']
})
export class GreetingComponent implements OnInit {

  @Output() close = new EventEmitter<void>();
  constructor() {
  }

  ngOnInit(): void {
  }

}
