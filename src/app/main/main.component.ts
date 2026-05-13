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
  public creator = new FormControl('');
  public artType = new FormControl('');
  public century = new FormControl('');

  constructor(
    public dataService: DataService,
    public paginationService: PaginationService,
  ) {}

  ngOnInit(): void {
    this.searchForm = new FormGroup({
      searchKeyword: this.searchKeyword,
      creator: this.creator,
      artType: this.artType,
      century: this.century,
    });
  }

  onSubmit(): void {
    this.dataService.applySearch({
      keyword: this.searchKeyword.value,
      creator: this.creator.value,
      type: this.artType.value,
      creationDate: this.century.value,
    });
    this.searchKeyword.reset();
  }
}
