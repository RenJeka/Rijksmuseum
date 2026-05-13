import {Component, OnInit} from '@angular/core';
import {FormControl, FormGroup} from '@angular/forms';

import {DataService} from 'src/app/shared/data.service';
import {PaginationService} from 'src/app/shared/pagination.service';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit {

  public searchForm: FormGroup;
  public searchKeyword = new FormControl('');

  constructor(
    public dataService: DataService,
    public paginationService: PaginationService,
  ) {}

  ngOnInit(): void {
    this.searchForm = new FormGroup({
      searchKeyword: this.searchKeyword,
    });
  }

  onSubmit(): void {
    this.dataService.searchCollection('', this.searchKeyword.value);
    this.searchKeyword.reset();
  }
}
