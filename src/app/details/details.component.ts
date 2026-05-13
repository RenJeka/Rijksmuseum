import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {Observable, of} from 'rxjs';

import {DataService} from 'src/app/shared/data.service';
import {IArtObjectDetails} from 'src/app/shared/iart-object-details';

@Component({
  selector: 'app-details',
  templateUrl: './details.component.html',
  styleUrls: ['./details.component.scss']
})
export class DetailsComponent implements OnInit {

  artObjectDetails: IArtObjectDetails;
  imageUrl$: Observable<string | null> = of(null);
  imageUrlLarge$: Observable<string | null> = of(null);

  constructor(
    private dataService: DataService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.dataService.setupOnInitComponents(this.route)
      .subscribe((responseObjDetails) => {
        this.artObjectDetails = responseObjDetails;
        this.imageUrl$ = this.dataService.getImageById(responseObjDetails.artObject.id, 800);
        this.imageUrlLarge$ = this.dataService.getImageById(responseObjDetails.artObject.id, 1200);
      });
  }

  onPressCategory(categoryName: string): void {
    this.dataService.searchCollection('', categoryName);
    this.router.navigate(['/']);
  }

  searchByTag(searchingTagObj: { [propName: string]: any }): void {
    this.dataService.searchByTag(searchingTagObj);
    this.router.navigate(['/']);
  }
}
