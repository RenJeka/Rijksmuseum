/**
 * Token-based pagination state for the new data.rijksmuseum.nl Search API.
 *
 * The new API does not expose page numbers — only a `pageToken` from the
 * previous response. `currentPageNumber` is a client-side counter for display.
 */
export interface IPaginatorState {
  totalItems: number;
  currentPageToken: string | null;
  nextPageToken: string | null;
  prevPageToken: string | null;
  currentPageNumber: number;
  readonly pageSize: number;
}

export const PAGE_SIZE = 100;

export const INITIAL_PAGINATOR_STATE: IPaginatorState = {
  totalItems: 0,
  currentPageToken: null,
  nextPageToken: null,
  prevPageToken: null,
  currentPageNumber: 1,
  pageSize: PAGE_SIZE,
};
