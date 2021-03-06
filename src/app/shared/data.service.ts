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

  /**
   * Метод получает коллекцию с сервера
   */
  getCollection(): Observable<IArtCollection> {
    this.deleteEmptyPropertiesInObject(this.urlQueryParams);
    const queryParams = Object.entries(this.urlQueryParams).map(arrPair => arrPair.join('=')).join('&');
    this.isArtCollectionLoaded = false;
    return this.http.get<IArtCollection>(`https://www.rijksmuseum.nl/api/en/collection?${queryParams}`);
  }

  /**
   * Метод запускает запрос для получения коллекции Арт Объектов с условием поиска
   * @param orderBy — тип сортировки
   * @param searchKewword — Ключевое слово для поиска
   */
  searchCollection(orderBy: string, searchKewword?: string): void {

    // Проверяем на подлинность выбраного значения "select"
    const allowdSotTypeIndex = this.allowedSortTypes.findIndex((sortType) => sortType === orderBy.trim());
    if (allowdSotTypeIndex >= 0 && allowdSotTypeIndex < this.allowedSortTypes.length) {
    } else {
      // Если переданный тип сортировки  не прошел проверку — берем первый тип сортировки с разрешенных типов
      // (установка по умолчанию)
      orderBy = this.allowedSortTypes[0];
    }
    this.urlQueryParams.s = orderBy;
    if (searchKewword && searchKewword.trim().length > 0) {
      this.urlQueryParams.q = encodeURI(searchKewword);
    } else {
      delete this.urlQueryParams.q;
    }
    this.paginationService.paginatorSettings.currentPage = 1;
    this.setUpDataService(this.getCollection());
  }

  /**
   * Метод получает дополнительную информацию о объекте искусства
   * @param objectNumber Номер объекта, по которому нужно найти доп. информацию
   * @see https://data.rijksmuseum.nl/object-metadata/api/#collection-details-api
   */
  getArtObjectDetail(objectNumber: string): Observable<IArtObjectDetails> {
    return this.http.get<IArtObjectDetails>(`https://www.rijksmuseum.nl/api/en/collection/${objectNumber}?key=${this.apiKey}`);
  }

  /**
   * Метод запускает запрос для получения коллекции Арт Объектов с условием поиска по тегам
   * @param searchingTagObj — объект с тегом и его значением
   */
  public searchByTag(searchingTagObj: { [propName: string]: any }) {
    this.fillUrlQueryParams(searchingTagObj);
    this.paginationService.paginatorSettings.currentPage = 1;
    this.setUpDataService(this.getCollection());
  }

  /**
   * Метод удаляет пустые свойства у объекта
   * @param objectLink Объект, у которого нужно найти и удалить пустые свойства
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
   * Метод правильно заполняет объект с QueryParams (с которого будут в последствии взяты параметры запроса, чтобы
   * сделать запрос на сервер)
   * @param params параметры, значениями которых необходимо заполнить объект "urlQueryParams"
   */
  public fillUrlQueryParams(params: { [propName: string]: any }): void {
    for (let key in params) {
      if (this.allowedQueryParams.indexOf(key) !== -1) {

        // свойства 'f.dating.period' и 'f.normalized32Colors.hex' должны быть в правильном формате
        switch (key) {
          case 'f.dating.period': {
            if ((parseInt(params[key]) > 0 && parseInt(params[key]) <= 21)) {
              this.urlQueryParams[key] = params[key];
            } else {
              throw new Error('Значение параметра  \'f.dating.period\' должно быть от \'0\' до \'21\', а вы передали' +
                ' ${params[key]}');
            }
            break;
          }

          case 'f.normalized32Colors.hex': {
            if ((/#[a-f0-9]{3,6}/gi).test(params[key])) {
              this.urlQueryParams[key] = params[key];
            } else {
              throw new Error(`Значение параметра 'f.normalized32Colors.hex' должно быть в формате HTMLhexColor, а  вы передали ${params[key]}`);
            }
            break;
          }

          default: {
            this.urlQueryParams[key] = params[key];
          }
        }
      } else {
        throw new Error('Вы передали неверное название параметра')
      }
    }
  }

  /**
   * Метод записывает необходимые свойства этого сервиса (data.servise) при ответе от сервера.
   * @param observable Observable-объект запроса данных (IArtCollection)
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
   * @deprecated
   * Метод возвращает элемент Арт-коллекции (1 арт-объект), кот-й соответствует переданному в параметр ID
   * @param artObjectID — ID арт-объекта, который необходимо найти и вернуть
   */
  public getArtObjectById(artObjectID: string): IArtObject {
    if (this.artCollection) {
      return this.artCollection.artObjects.find(predicate => predicate.id === artObjectID);
    } else {
      this.setUpDataService(this.getCollection())
        .then(responseArtCollection => {
          this.artCollection = responseArtCollection;
          return this.artCollection.artObjects.find(predicate => predicate.id === artObjectID);
        });
    }
  }

  public getSmallImageURL(imageURL: string, imageWidth: number = 500): string {
    const INDEX_EQUAL_SIGHN =  imageURL.indexOf('=');
    let nessesaryString;
    if (INDEX_EQUAL_SIGHN === -1) {
      return imageURL;
    }
    nessesaryString = imageURL.slice(0, INDEX_EQUAL_SIGHN + 1);
    return nessesaryString + 's' + imageWidth;
  }

  /**
   * Метод настраивает инициализацию компонента (передает в компонент нужный Арт-объект)
   * @description Задача меотда — дать более простой интерфейс для инициализации компонента и
   * избавится от повторяющегося кода.
   * @param activatedRoute ссылка на инжектированный "activatedRoute" в компоненте
   */
  public setupOnInitComponents(activatedRoute: ActivatedRoute): Observable<IArtObjectDetails> {

    return new Observable<IArtObjectDetails>((observer) => {

      activatedRoute.params.subscribe((params: Params) => {

        // Если запрос на получения детальных данных уже сделан для этого арт-объекта — просто возвращаем эти данные
        // (чтобы не делать повторный запрос)
        if (this.currentArtObjectDetails && (this.currentArtObjectDetails.artObject.objectNumber === params.objNumber)) {
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
}
