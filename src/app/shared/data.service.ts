import {Injectable} from '@angular/core';
import {ActivatedRoute, Params} from '@angular/router';
import {forkJoin, Observable, of, throwError} from 'rxjs';
import {map, switchMap, tap} from 'rxjs/operators';

import {IArtCollection} from 'src/app/shared/iart-collection';
import {IArtObject} from 'src/app/shared/iart-object';
import {IArtObjectDetails} from 'src/app/shared/iart-object-details';
import {ImageLoaderService} from 'src/app/shared/api/image-loader.service';
import {LinkedArtAdapter} from 'src/app/shared/api/linked-art.adapter';
import {PaginationService} from 'src/app/shared/pagination.service';
import {RijksLinkedArtClient} from 'src/app/shared/api/rijks-linked-art.client';
import {SearchParams} from 'src/app/shared/api/linked-art-types';

interface SearchState {
  q: string;
  type: string;
  material: string;
  technique: string;
}

@Injectable({providedIn: 'root'})
export class DataService {

  showFavorite = false;
  artCollection: IArtCollection;
  artObjects: IArtObject[];
  currentArtObjectDetails: IArtObjectDetails;
  isArtCollectionLoaded = false;
  isObjDetailsLoaded = false;
  favoriteArtCollection: IArtObjectDetails[] = [];

  private searchState: SearchState = {q: '', type: '', material: '', technique: ''};

  constructor(
    private client: RijksLinkedArtClient,
    private adapter: LinkedArtAdapter,
    private imageLoader: ImageLoaderService,
    private paginationService: PaginationService,
  ) {
    this.paginationService.pageChange$.subscribe(() => {
      this.runSearch();
    });
    // Initial load
    this.runSearch();
  }

  /** Fetches the current page of search results and updates service state. */
  getCollection(): Observable<IArtCollection> {
    const params: SearchParams = {imageAvailable: 'true'};
    if (this.searchState.q) {
      params.title = this.searchState.q;
    }
    if (this.searchState.type) {
      params.type = this.searchState.type;
    }
    if (this.searchState.material) {
      params.material = this.searchState.material;
    }
    if (this.searchState.technique) {
      params.technique = this.searchState.technique;
    }
    const token = this.paginationService.currentState.currentPageToken;
    if (token) {
      params.pageToken = token;
    }

    this.isArtCollectionLoaded = false;

    return this.client.searchCollection(params).pipe(
      tap((page) => {
        this.paginationService.applySearchResponse(
          page.next?.id,
          page.prev?.id,
          page.partOf?.totalItems || 0,
        );
      }),
      switchMap((page) => {
        const ids = (page.orderedItems || []).map((it) => this.client.extractNumericId(it.id));
        if (ids.length === 0) {
          return of({total: page.partOf?.totalItems || 0, artObjects: [] as IArtObject[]});
        }
        const requests = ids.map((id) => this.client.getHumanMadeObject(id));
        return forkJoin(requests).pipe(
          map((objects) => ({
            total: page.partOf?.totalItems || 0,
            artObjects: objects.map((o) => this.adapter.mapHumanMadeObjectToArtObject(o)),
          })),
        );
      }),
      map(({total, artObjects}) => ({artObjects, count: total} as IArtCollection)),
    );
  }

  /**
   * Triggered by the search form. `orderBy` is ignored — the new API has no
   * sorting parameter — kept for signature compatibility.
   */
  searchCollection(_orderBy: string, searchKeyword?: string): void {
    this.searchState.q = searchKeyword?.trim() || '';
    this.searchState.type = '';
    this.searchState.material = '';
    this.searchState.technique = '';
    this.imageLoader.reset();
    this.paginationService.reset();
  }

  /** Triggered by clicking a material/technique/type tag in the details page. */
  searchByTag(searchingTagObj: { [propName: string]: any }): void {
    this.searchState = {q: '', type: '', material: '', technique: ''};
    if (typeof searchingTagObj.type === 'string') {
      this.searchState.type = searchingTagObj.type;
    }
    if (typeof searchingTagObj.material === 'string') {
      this.searchState.material = searchingTagObj.material;
    }
    if (typeof searchingTagObj.technique === 'string') {
      this.searchState.technique = searchingTagObj.technique;
    }
    this.imageLoader.reset();
    this.paginationService.reset();
  }

  /**
   * Resolve a museum object number (e.g. "SK-C-5") into full Linked Art details.
   * Performs a search by `objectNumber` to obtain the LOD id, then fetches the
   * HumanMadeObject and (if present) its VisualItem for iconclass categories.
   */
  getArtObjectDetail(objectNumber: string): Observable<IArtObjectDetails> {
    return this.client.searchCollection({objectNumber}).pipe(
      switchMap((page) => {
        const first = (page.orderedItems || [])[0];
        if (!first) {
          return throwError(`Object ${objectNumber} not found`);
        }
        const numericId = this.client.extractNumericId(first.id);
        return this.client.getHumanMadeObject(numericId);
      }),
      switchMap((la) => {
        const visualUrl = la.shows?.[0]?.id;
        const visual$ = visualUrl
          ? this.client.getVisualItem(this.client.extractNumericId(visualUrl))
          : of(null);
        return visual$.pipe(map((vi) => this.adapter.mapToArtObjectDetails(la, vi)));
      }),
    );
  }

  /**
   * Provides cached art-object details to popup/detail components. When the
   * route param matches the already-loaded object, returns it without a refetch.
   */
  setupOnInitComponents(activatedRoute: ActivatedRoute): Observable<IArtObjectDetails> {
    return new Observable<IArtObjectDetails>((observer) => {
      activatedRoute.params.subscribe((params: Params) => {
        const objNum = params.objNumber;
        if (
          this.currentArtObjectDetails
          && this.currentArtObjectDetails.artObject.objectNumber === objNum
        ) {
          observer.next(this.currentArtObjectDetails);
          return;
        }
        this.isObjDetailsLoaded = false;
        this.getArtObjectDetail(objNum).subscribe(
          (response) => {
            this.currentArtObjectDetails = response;
            this.isObjDetailsLoaded = true;
            observer.next(response);
          },
          (err) => {
            console.error(`Failed to load details for ${objNum}:`, err);
          },
        );
      });
    });
  }

  /**
   * Returns an Observable IIIF image URL for the given object id, scaled to
   * the requested width. Resolution is lazy and cached.
   */
  getImageById(idOrUrl: string, width: number = 500): Observable<string | null> {
    return this.imageLoader.getImageUrl(idOrUrl, width);
  }

  // ===== internals =====

  private runSearch(): void {
    this.showFavorite = false;
    this.getCollection().subscribe(
      (collection) => {
        this.artCollection = collection;
        this.artObjects = collection.artObjects;
        this.isArtCollectionLoaded = true;
      },
      (err) => {
        console.error('Failed to load collection:', err);
        this.artCollection = {artObjects: [], count: 0};
        this.artObjects = [];
        this.isArtCollectionLoaded = true;
      },
    );
  }
}
