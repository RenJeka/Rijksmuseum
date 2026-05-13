import {Injectable} from '@angular/core';
import {BehaviorSubject, Subject} from 'rxjs';

import {IPaginatorState, INITIAL_PAGINATOR_STATE, PAGE_SIZE} from 'src/app/shared/ipaginator-settings';

/**
 * Token-based pagination for the new Rijksmuseum Search API.
 *
 * - `paginatorStream$` — BehaviorSubject of the current state. Used by UI for reads
 *   and also by DataService to react to user-initiated page changes.
 * - User actions (`goNext`, `goPrev`, `reset`) mutate state and emit on the stream.
 * - `applySearchResponse` updates token bookkeeping post-search; it emits too so
 *   UI re-renders the counter, but `pageChange$` is used by DataService to
 *   distinguish "user wants a new page" from "search response arrived".
 */
@Injectable({providedIn: 'root'})
export class PaginationService {

  private state: IPaginatorState = {...INITIAL_PAGINATOR_STATE};

  paginatorStream$ = new BehaviorSubject<IPaginatorState>(this.state);

  /** Emits only on user-initiated page changes (goNext, goPrev, reset). */
  pageChange$ = new Subject<void>();

  get currentState(): IPaginatorState {
    return this.state;
  }

  goNext(): void {
    if (!this.state.nextPageToken) {
      return;
    }
    this.state = {
      ...this.state,
      currentPageToken: this.state.nextPageToken,
      currentPageNumber: this.state.currentPageNumber + 1,
    };
    this.paginatorStream$.next(this.state);
    this.pageChange$.next();
  }

  goPrev(): void {
    if (this.state.currentPageNumber <= 1) {
      return;
    }
    this.state = {
      ...this.state,
      currentPageToken: this.state.prevPageToken,
      currentPageNumber: Math.max(1, this.state.currentPageNumber - 1),
    };
    this.paginatorStream$.next(this.state);
    this.pageChange$.next();
  }

  /** Resets to the first page. Used on new search / filter change. */
  reset(): void {
    this.state = {...INITIAL_PAGINATOR_STATE};
    this.paginatorStream$.next(this.state);
    this.pageChange$.next();
  }

  /** Bookkeeping after a search response — updates totals & tokens, emits state. */
  applySearchResponse(nextUrl: string | undefined, prevUrl: string | undefined, totalItems: number): void {
    this.state = {
      ...this.state,
      totalItems,
      nextPageToken: this.parseToken(nextUrl),
      prevPageToken: this.parseToken(prevUrl),
    };
    this.paginatorStream$.next(this.state);
  }

  /** Estimated total number of pages (ceil totalItems / pageSize). 0 if no results. */
  get totalPages(): number {
    return this.state.totalItems > 0
      ? Math.ceil(this.state.totalItems / PAGE_SIZE)
      : 0;
  }

  hasNext(): boolean {
    return !!this.state.nextPageToken;
  }

  hasPrev(): boolean {
    return this.state.currentPageNumber > 1;
  }

  private parseToken(url: string | undefined): string | null {
    if (!url) {
      return null;
    }
    try {
      return new URL(url).searchParams.get('pageToken');
    } catch {
      const match = url.match(/[?&]pageToken=([^&]+)/);
      return match ? decodeURIComponent(match[1]) : null;
    }
  }
}
