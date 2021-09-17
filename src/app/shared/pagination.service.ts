import {Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
// import {DataService} from "src/app/shared/data.service";

type OddNumbers = 1 | 3 | 5 | 7 | 9 | 11 | 13 | 15; // TODO: Find a way to specify only odd numbers in the interface

interface IPaginatorSettings {
  currentPage: number;
  paginatorScaleLength: OddNumbers;
  objectPerPage: number;
  maximumPages: number | null;
  allowedResultsPerPage: string[];
  paging: number[];
}

@Injectable({
  providedIn: 'root'
})
export class PaginationService {


  paginatorSettings = {
    currentPage: 1,
    paginatorScaleLength: 5 as OddNumbers,
    maximumPages: null,
    objectPerPage: 30,
    allowedResultsPerPage: ['20', '30', '50', '100'],
    paging: []

    // // TODO: Implement property "paginatorScaleLength" via 'get', 'set'
    // set paginatorScaleLength(lengthNum: number) {
    //   this.paginatorSettings._paginatorScaleLength = lengthNum as OddNumbers;
    // },
    // get paginatorScaleLength() {
    //   return this.paginatorSettings._paginatorScaleLength
    // },
    // _paginatorScaleLength: 5,

  };

  // TODO: How to create "get" and "set" properties inside an object (eg inside "paginatorSettings" - a property
  //  maximumObjects)
  private _maximumObjects: number;
  get maximumObjects(): number {
    return this._maximumObjects;
  }

  set maximumObjects(value: number) {
    this._maximumObjects = value;
    this.paginatorSettings.maximumPages = this.getMaximumPage();
    this.recalculatePaging();
  }

  paginatorStream$: BehaviorSubject<IPaginatorSettings> = new BehaviorSubject(this.paginatorSettings);

  constructor() {}

  /**
   * The method recalculates the scale by pagination (pagination scale)
   * After each change related to pagination - this method should be called to recalculate the pagination scale
   */
  recalculatePaging(): void {
    let pages = [];
    let startPagingNumber: number;
    let endPagingNumber: number;
    let halfPaging = (Math.floor(this.paginatorSettings.paginatorScaleLength / 2));

    // Find the page number from which pagination should start
    startPagingNumber = +this.paginatorSettings.currentPage - halfPaging;
    if (startPagingNumber <= 0) {
      startPagingNumber = 1
    }
    // Find the page number where pagination ends
    endPagingNumber = +this.paginatorSettings.currentPage + halfPaging;
    // If the number on which the pagination ends is out of range
    if (endPagingNumber > this.paginatorSettings.maximumPages) {
      endPagingNumber = this.paginatorSettings.maximumPages;
    }

    // TODO: how can I refactor this code without a lot of checks
    // Case if there are fewer pages than paginatorScaleLength (default 5)
    if (this.paginatorSettings.maximumPages < this.paginatorSettings.paginatorScaleLength) {
      for (let i = 0; i < endPagingNumber; i++) {
        pages.push(startPagingNumber);
        startPagingNumber++;
      }
    } else {
      // Case for last pages (If the inferred last page (endPagingNumber) is out of range)
      if (endPagingNumber === this.paginatorSettings.maximumPages) {
        startPagingNumber = this.paginatorSettings.maximumPages - (this.paginatorSettings.paginatorScaleLength - 1);
        for (let i = 0; i < this.paginatorSettings.paginatorScaleLength; i++) {
          pages.push(startPagingNumber);
          startPagingNumber++;
        }
        // All other cases
      } else {
        for (let i = 0; i < this.paginatorSettings.paginatorScaleLength; i++) {
          pages.push(startPagingNumber);
          startPagingNumber++;
        }
      }
    }

    this.paginatorSettings.paging = pages;
  }

  /**
   * The method recalculates and overwrites the value of the maximum page in the pagination.
   */
  private getMaximumPage(): number {
    let irregularMaximumPage: number;

    if (this.maximumObjects >= 10000) {
      return Math.floor(10000 / this.paginatorSettings.objectPerPage);
    } else {
      irregularMaximumPage = Math.floor(this.maximumObjects / this.paginatorSettings.objectPerPage);
      if (irregularMaximumPage === 0) {
        return 1;
      } else {
        return irregularMaximumPage;
      }
    }
  }

  /**
   * The method changes the settings of the pagination object
   * and emits a stream (sends the settings to another service)
   */
  private setChangies(currentPage?: number): void {

    if (currentPage) {
      this.paginatorSettings.currentPage = currentPage;
    }
    this.paginatorSettings.maximumPages = this.getMaximumPage();
    this.recalculatePaging();
    this.paginatorStream$.next(this.paginatorSettings);
  }

  // ===== USER INTERFACE — START =====
  changeResultsPerPage(numberOfResultsPerPage: number): void {

    let tempMaxPages: number;
    let isCurrentPageOverLimit: boolean;

    this.paginatorSettings.objectPerPage = numberOfResultsPerPage;
    tempMaxPages = this.getMaximumPage();
    isCurrentPageOverLimit = this.paginatorSettings.currentPage > tempMaxPages;
    // If the maximum number of pages is less (the user selected more results on the page)
    // and the current page goes beyond the (maximum possible page) - then we redirect
    // the user to the current maximum possible page
    if ((tempMaxPages < this.paginatorSettings.maximumPages) && isCurrentPageOverLimit) {
      this.paginatorSettings.currentPage = tempMaxPages;
    }
    this.setChangies();
  }

  changePage(page: number): void {
    if (page < 1) {
      page = 1;
    } else if (page > this.paginatorSettings.maximumPages) {
      page = this.paginatorSettings.maximumPages;
    }
    this.setChangies(page);
  }

  goToStart(): void {
    this.setChangies(1);
  }

  goToFinish(): void {
    this.setChangies(this.paginatorSettings.maximumPages);
  }

  goPrev(): void {
    if (this.paginatorSettings.currentPage > 1) {
      this.setChangies(--this.paginatorSettings.currentPage);
    } else {
      this.setChangies(1);
    }
  }

  goNext(): void {
    if (this.paginatorSettings.currentPage < this.paginatorSettings.maximumPages) {
      this.setChangies(++this.paginatorSettings.currentPage);
    } else {
      this.setChangies(this.paginatorSettings.maximumPages);
    }
  }
  // ===== USER INTERFACE — FINISH =====
}
