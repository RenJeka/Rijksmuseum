import {Injectable} from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {ActivatedRoute, Params} from "@angular/router";
import {Observable, Subject} from "rxjs";

import {IArtCollection} from "src/app/shared/iart-collection";
import {IArtObject} from "src/app/shared/iart-object";
import {IArtObjectDetails} from "src/app/shared/iart-object-details";
import {PaginationService} from "src/app/shared/pagination.service";

@Injectable({
  providedIn: 'root'
})
export class DataService {

  private apiKey = 'v6nas9kT';
  private urlQueryParams = {
    key: this.apiKey,
    p: this.paginationService.paginatorSettings.currentPage.toString(),
    ps: this.paginationService.paginatorSettings.objectPerPage.toString(),
    s: 'relevance',
    q: '',
    imgonly: 'True',
    type: '',
    material: '',
    technique: '',
    'f.dating.period': '',
    'f.normalized32Colors.hex': '',
  };
  private allowedSortTypes = [
    'relevance',
    'objecttype',
    'chronologic',
    'achronologic',
    'artist',
    'artistdesc',
  ];
  private allowedQueryParams = [
    'key',
    'p',
    'ps',
    's',
    'q',
    'imgonly',
    'type',
    'material',
    'technique',
    'f.dating.period',
    'f.normalized32Colors.hex',
  ];

  showFavorite = false;
  artCollection: IArtCollection;
  artObjects: IArtObject[];
  currentArtObjectDetails: IArtObjectDetails;
  isArtCollectionLoaded = false;
  isObjDetailsLoaded = false;
  favoriteArtCollection: IArtObjectDetails[] = [];
  constructor(
    private http: HttpClient,
    private paginationService: PaginationService,
  ) {
    this.paginationService.paginatorStream$
      .subscribe((paginationSettings) => {
        this.urlQueryParams.p = paginationSettings.currentPage.toString();
        this.urlQueryParams.ps = paginationSettings.objectPerPage.toString();
        this.setUpDataService(this.getCollection());
      });
  }

  public getCollection(): Observable<IArtCollection> {
    this.deleteEmptyPropertiesInObject(this.urlQueryParams);
    const queryParams = Object.entries(this.urlQueryParams).map(arrPair => arrPair.join('=')).join('&');
    this.isArtCollectionLoaded = false;
    return this.http.get<IArtCollection>(`https://www.rijksmuseum.nl/api/en/collection?${queryParams}`);
  }

  /**
   * The method starts a request to get a collection of Art Objects with a search condition
   * @param orderBy — type of sorting
   * @param searchKeyword — keyword for search results
   */
  public searchCollection(orderBy: string, searchKeyword?: string): void {

    // Check the authenticity of the chosen value "select"
    const allowedSortTypeIndex = this.allowedSortTypes.findIndex((sortType) => sortType === orderBy.trim());
    if (allowedSortTypeIndex >= 0 && allowedSortTypeIndex < this.allowedSortTypes.length) {
    } else {
      // If the passed sorting type did not pass validation, take the first sorting type from the allowed types
      // (default setting)
      orderBy = this.allowedSortTypes[0];
    }
    this.urlQueryParams.s = orderBy;
    if (searchKeyword && searchKeyword.trim().length > 0) {
      this.urlQueryParams.q = encodeURI(searchKeyword);
    } else {
      delete this.urlQueryParams.q;
    }
    this.paginationService.paginatorSettings.currentPage = 1;
    this.setUpDataService(this.getCollection());
  }

  /**
   * To get detail information about Art Object
   * @param objectNumber Object number by which you need to find additional information.
   * @see https://data.rijksmuseum.nl/object-metadata/api/#collection-details-api
   */
  public getArtObjectDetail(objectNumber: string): Observable<IArtObjectDetails> {
    return this.http.get<IArtObjectDetails>(`https://www.rijksmuseum.nl/api/en/collection/${objectNumber}?key=${this.apiKey}`);
  }

  /**
   * The method launches a request to get a collection of Art Objects with a search condition by tags
   * @param searchingTagObj — an object with a tag and its value
   */
  public searchByTag(searchingTagObj: { [propName: string]: any }) {
    this.fillUrlQueryParams(searchingTagObj);
    this.paginationService.paginatorSettings.currentPage = 1;
    this.setUpDataService(this.getCollection());
  }

  /**
   * @param objectLink The object from which you want to find and remove empty properties
   */
  private deleteEmptyPropertiesInObject(objectLink: { [propName: string]: string }): void {
    const objectKeys = Object.keys(objectLink);
    const emptyKeys = objectKeys.filter((key) => {
      // Если свойство объекта пустое или оно === null — добавляем его в отфильтрованный массив
      return objectLink[key].trim().length <= 0;
    });

    emptyKeys.forEach((key) => {
      delete objectLink[key];
    });
  }

  /**
   * The method correctly fills an object with QueryParams
   * (from which query parameters will be taken later to make a request to the server)
   * @param params the object "urlQueryParams" will be filled with these values
   */
  public fillUrlQueryParams(params: { [propName: string]: any }): void {
    for (let key in params) {
      if (this.allowedQueryParams.indexOf(key) !== -1) {

        // properties 'f.dating.period' and 'f.normalized32Colors.hex' must be in correct format
        switch (key) {
          case 'f.dating.period': {
            if ((parseInt(params[key]) > 0 && parseInt(params[key]) <= 21)) {
              this.urlQueryParams[key] = params[key];
            } else {
              throw new Error('Parameter value  \'f.dating.period\' must to be from  \'0\' to \'21\', but you passed' +
                ' ${params[key]}');
            }
            break;
          }

          case 'f.normalized32Colors.hex': {
            // /#[a-f0-9]{3,6}/gi  — HTMLhexColor RegExp (for example '#d3d6d8')
            if ((/#[a-f0-9]{3,6}/gi).test(params[key])) {
              this.urlQueryParams[key] = params[key];
            } else {
              throw new Error(`The value of the 'f.normalized32Colors.hex' parameter must be in HTMLhexColor format, but you passed ${params[key]}`);
            }
            break;
          }

          default: {
            this.urlQueryParams[key] = params[key];
          }
        }
      } else {
        throw new Error('You passed the wrong parameter name');
      }
    }
  }

  /**
   * The method writes the required properties of this service (data.servise) when responding from the server.
   * @param observable - data request object (IArtCollection)
   */
  public setUpDataService(observable: Observable<IArtCollection>): Promise<IArtCollection> {
    this.showFavorite = false;
    return new Promise<IArtCollection>((resolve) => {
      observable.subscribe((responseArtCollection) => {
        this.artCollection = responseArtCollection;
        this.artObjects = responseArtCollection.artObjects;
        this.isArtCollectionLoaded = true;
        this.paginationService.maximumObjects = responseArtCollection.count;
        resolve(responseArtCollection);
      });
    });
  }

  /**
   * The method configures the initialization of the component (transfers the required Art object to the component)
   * @description The goal of the method is to provide a simpler interface for initializing the component
   * and avoid of repetitive code.
   * @param activatedRoute ссылка на инжектированный activatedRoute" в компоненте
   */
  public setupOnInitComponents(activatedRoute: ActivatedRoute): Observable<IArtObjectDetails> {

    return new Observable<IArtObjectDetails>((observer) => {

      activatedRoute.params.subscribe((params: Params) => {

        // If a request has already been made for this art object to get detailed data, just return this data
        // (to avoid making a second request)
        if (
          this.currentArtObjectDetails
          && (this.currentArtObjectDetails.artObject.objectNumber === params.objNumber)
          ) {
          observer.next(this.currentArtObjectDetails);
        } else {

          this.isObjDetailsLoaded = false;
          this.getArtObjectDetail(params.objNumber)
            .subscribe(response => {
              this.currentArtObjectDetails = response;
              this.isObjDetailsLoaded = true;
              observer.next(response);
            });
        }
      });
    });
  }

  public getImageById(id: string, width: number = 500): string | null {
    const artObjectImageUrl = this.getArtObjectImageUrl(id);
    if (!artObjectImageUrl) {
      return null;
    }

    const url = this.getImageURLwithSize(artObjectImageUrl, width);
    console.log('url ', url);
    return url;
  }

  private getArtObjectById(artObjectID: string): IArtObject | null {
    if (!this.artObjects) {
      return null;
    }
    return this.artObjects.find(predicate => predicate.id === artObjectID) || null;
  }

  private getArtObjectImageUrl(artObjectID: string): string | null {
    if (this.currentArtObjectDetails
        && this.currentArtObjectDetails.artObject.id === artObjectID
        && this.currentArtObjectDetails.artObject.webImage?.url) {
      return this.currentArtObjectDetails.artObject.webImage.url;

    } else {
      return this.getArtObjectById(artObjectID)?.webImage?.url || null;
    }
  }

  private getImageURLwithSize(imageURL: string, imageWidth: number = 500): string {
    const INDEX_EQUAL_SIGHN =  imageURL.indexOf('=');
    let nessesaryString;
    if (INDEX_EQUAL_SIGHN === -1) {
      return imageURL;
    }
    nessesaryString = imageURL.slice(0, INDEX_EQUAL_SIGHN + 1);
    return nessesaryString + 's' + imageWidth;
  }
}
