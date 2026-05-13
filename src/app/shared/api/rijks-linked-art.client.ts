import {Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';

import {
  LAHumanMadeObject,
  LAVisualItem,
  LADigitalObject,
  SearchOrderedCollectionPage,
  SearchParams,
} from 'src/app/shared/api/linked-art-types';

const API_BASE = 'https://data.rijksmuseum.nl';
const SEARCH_URL = `${API_BASE}/search/collection`;

@Injectable({providedIn: 'root'})
export class RijksLinkedArtClient {

  constructor(private http: HttpClient) {}

  /**
   * Returns an OrderedCollectionPage with up to 100 LOD identifiers.
   * The new API has no API key, no CORS issues from localhost,
   * and token-based pagination only (see SearchOrderedCollectionPage.next.id).
   */
  searchCollection(params: SearchParams = {}): Observable<SearchOrderedCollectionPage> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach((key) => {
      const value = (params as any)[key];
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });
    return this.http.get<SearchOrderedCollectionPage>(SEARCH_URL, {params: httpParams});
  }

  /**
   * Resolve a LOD identifier (numeric part or full URL) into its Linked Art JSON.
   */
  getHumanMadeObject(idOrUrl: string): Observable<LAHumanMadeObject> {
    return this.http.get<LAHumanMadeObject>(this.toDataUrl(idOrUrl));
  }

  getVisualItem(idOrUrl: string): Observable<LAVisualItem> {
    return this.http.get<LAVisualItem>(this.toDataUrl(idOrUrl));
  }

  getDigitalObject(idOrUrl: string): Observable<LADigitalObject> {
    return this.http.get<LADigitalObject>(this.toDataUrl(idOrUrl));
  }

  /** Accepts "200100988", "https://id.rijksmuseum.nl/200100988", or already-data URL. */
  toDataUrl(idOrUrl: string): string {
    if (!idOrUrl) {
      return idOrUrl;
    }
    if (idOrUrl.startsWith(`${API_BASE}/`)) {
      return idOrUrl;
    }
    const numeric = this.extractNumericId(idOrUrl);
    return `${API_BASE}/${numeric}`;
  }

  /** Extracts the trailing numeric id from a Rijksmuseum LOD URL or returns input as-is. */
  extractNumericId(idOrUrl: string): string {
    if (!idOrUrl) {
      return idOrUrl;
    }
    const match = idOrUrl.match(/\/(\d+)(?:\?.*)?$/);
    return match ? match[1] : idOrUrl;
  }

  /** Reads pageToken from a "next"/"prev"/"last"/"first" URL. Returns null if not present. */
  extractPageToken(url: string | undefined): string | null {
    if (!url) {
      return null;
    }
    try {
      const u = new URL(url);
      return u.searchParams.get('pageToken');
    } catch {
      const match = url.match(/[?&]pageToken=([^&]+)/);
      return match ? decodeURIComponent(match[1]) : null;
    }
  }
}
