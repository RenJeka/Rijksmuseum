import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';

import {DataService} from 'src/app/shared/data.service';
import {IArtObjectDetails} from 'src/app/shared/iart-object-details';

@Component({
  selector: 'app-details',
  templateUrl: './details.component.html',
  styleUrls: ['./details.component.scss']
})
export class DetailsComponent implements OnInit {

  artObjectDetails: IArtObjectDetails;

  constructor(
    private dataService: DataService,
    private router: Router,
    private route: ActivatedRoute,
  ) { }

  ngOnInit(): void {
    this.dataService.setupOnInitComponents(this.route)
      .subscribe((responseObjDetails) => {
        this.artObjectDetails = responseObjDetails;
      });
  }

  getImageURL(width: number = 500): string | null {
    return this.dataService.getImageById(this.artObjectDetails.artObject.id, width);
  }

  onPressCategory(categoryName: string) {
    this.dataService.searchCollection('relevance', categoryName);
    this.router.navigate(['/']);
  }

  searchByTag(searchingTagObj: { [propName: string]: any }) {
    this.dataService.searchByTag(searchingTagObj);
    this.router.navigate(['/']);
  }
}
