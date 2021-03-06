import {Injectable} from '@angular/core';
import {BehaviorSubject} from "rxjs";
// import {DataService} from "src/app/shared/data.service";

type OddNumbers = 1 | 3 | 5 | 7 | 9 | 11 | 13 | 15; // TODO: Найти способ указать в интерфейсе только нечетные числа

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
    allowedResultsPerPage: ["20", "30", "50", "100"],
    paging: []

    // // TODO: Реализовать свойство "paginatorScaleLength" через 'get', 'set'
    // set paginatorScaleLength(lengthNum: number) {
    //   this.paginatorSettings._paginatorScaleLength = lengthNum as OddNumbers;
    // },
    // get paginatorScaleLength() {
    //   return this.paginatorSettings._paginatorScaleLength
    // },
    // _paginatorScaleLength: 5,

  };

  // TODO: Как создать свойства "get" и "set" внутри объекта ( напр. внутри "paginatorSettings" — свойство
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
   * Метод пересчитывает шкалу сос траницами (шкалу пагинации)
   * После каждого изменения, связаную с пагинацией,  —  этот метод должен вызываться чтобы пересчитать шкалу пагинации
   */
  recalculatePaging(): void {
    let pages = [];
    let startPagingNumber: number;
    let endPagingNumber: number;
    let halfPaging = (Math.floor(this.paginatorSettings.paginatorScaleLength / 2));

    // Находим номер страницы, с которой должна начинатся пагинация
    startPagingNumber = +this.paginatorSettings.currentPage - halfPaging;
    if (startPagingNumber <= 0) {
      startPagingNumber = 1
    }
    // Находим номер страницы, на котором заканчивается пагинация
    endPagingNumber = +this.paginatorSettings.currentPage + halfPaging;
    // Если номер, на котором заканчивается пагинация — выходитт за пределы допустимого
    if (endPagingNumber > this.paginatorSettings.maximumPages) {
      endPagingNumber = this.paginatorSettings.maximumPages
    }

    // TODO: как можно отрефакторить этот код, чтобы не было множества проверок
    // Случай, если страниц меньше, чем paginatorScaleLength (по умолч.  5)
    if (this.paginatorSettings.maximumPages < this.paginatorSettings.paginatorScaleLength) {
      for (let i = 0; i < endPagingNumber; i++) {
        pages.push(startPagingNumber);
        startPagingNumber++
      }
    } else {
      // Случай для последних страниц (Если предполагаемая последняя страница (endPagingNumber) вышла за пределы
      // допустимого)
      if (endPagingNumber === this.paginatorSettings.maximumPages) {
        startPagingNumber = this.paginatorSettings.maximumPages - (this.paginatorSettings.paginatorScaleLength - 1);
        for (let i = 0; i < this.paginatorSettings.paginatorScaleLength; i++) {
          pages.push(startPagingNumber);
          startPagingNumber++
        }
        // Все остальные случаи
      } else {
        for (let i = 0; i < this.paginatorSettings.paginatorScaleLength; i++) {
          pages.push(startPagingNumber);
          startPagingNumber++
        }
      }
    }

    this.paginatorSettings.paging = pages;
  }

  /**
   * Метод пересчитывает и перезаписывает значение максимальной страницы в пагинации.
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
   * Метод изменяет настройки объекта пагинации и эмитит стрим (отправляет настройки в другой сервис)
   * @param currentPage текущая страница
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
    // Если максимальное кол-во страниц меньше (пользователь выбрал больше результатов на странице) и текущая
    // страница выходит за пределы (максимально-возможной страницы) — тогда перенаправляем пользователя на текущую
    // максимально возможную страницу
    if ((tempMaxPages < this.paginatorSettings.maximumPages) && isCurrentPageOverLimit) {
      this.paginatorSettings.currentPage = tempMaxPages;
    }
    this.setChangies();
  }

  changePage(page: number): void {
    if (page < 1) {
      page = 1
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
