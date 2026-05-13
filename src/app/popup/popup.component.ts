import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {Observable, of} from 'rxjs';

import {DataService} from 'src/app/shared/data.service';
import {IArtObjectDetails} from 'src/app/shared/iart-object-details';

@Component({
  selector: 'app-popup',
  templateUrl: './popup.component.html',
  styleUrls: ['./popup.component.scss']
})
export class PopupComponent implements OnInit {

  public get isArtObjectLoaded(): boolean {
    return this.dataService.isArtCollectionLoaded;
  }

  artObjectDetails: IArtObjectDetails;
  isInFavoriteCollection = false;
  imageUrl$: Observable<string | null> = of(null);
  imageUrlLarge$: Observable<string | null> = of(null);

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private dataService: DataService,
  ) {}

  ngOnInit(): void {
    this.dataService.setupOnInitComponents(this.route)
      .subscribe((responseObjDetails) => {
        this.artObjectDetails = responseObjDetails;
        this.imageUrl$ = this.dataService.getImageById(responseObjDetails.artObject.id, 500);
        this.imageUrlLarge$ = this.dataService.getImageById(responseObjDetails.artObject.id, 1200);
        this.isInFavoriteCollection = this.checkFavoriteCollection();
      });
  }

  private checkFavoriteCollection(): boolean {
    const isRepeatArtElement = this.dataService.favoriteArtCollection.find((element) => {
      return element.artObject.objectNumber === this.artObjectDetails.artObject.objectNumber;
    });
    return !!isRepeatArtElement;
  }

  goToDetail(): void {
    this.router.navigate(['/', 'detail', this.artObjectDetails.artObject.objectNumber]);
  }

  toggleToFavCollection(): void {
    if (!this.isInFavoriteCollection) {
      this.dataService.favoriteArtCollection.push(this.artObjectDetails);
      this.isInFavoriteCollection = true;
      return;
    }
    const favIndex = this.dataService.favoriteArtCollection.findIndex(
      (d) => d.artObject.objectNumber === this.artObjectDetails.artObject.objectNumber,
    );
    if (favIndex >= 0) {
      this.dataService.favoriteArtCollection.splice(favIndex, 1);
    }
    this.isInFavoriteCollection = false;
  }
}
