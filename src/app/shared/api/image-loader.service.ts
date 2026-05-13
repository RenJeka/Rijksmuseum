import {Injectable} from '@angular/core';
import {Observable, of, ReplaySubject} from 'rxjs';
import {catchError, map, switchMap} from 'rxjs/operators';

import {RijksLinkedArtClient} from 'src/app/shared/api/rijks-linked-art.client';

/**
 * Resolves IIIF image URLs from a Rijksmuseum LOD object id.
 *
 * Each resolution walks a 3-call chain:
 *   HumanMadeObject -> VisualItem -> DigitalObject -> access_point[].id
 *
 * Results are cached per object id in-memory (lost on refresh). In-flight
 * requests are deduped via ReplaySubject so concurrent template bindings for
 * the same object never trigger more than one chain.
 *
 * Width is applied client-side to the IIIF base URL — IIIF supports
 * `/full/{width},/0/default.jpg` for arbitrary scaling.
 */
@Injectable({providedIn: 'root'})
export class ImageLoaderService {

  /** Base URL ReplaySubject per object id — shared between all observers. */
  private baseSubjects = new Map<string, ReplaySubject<string | null>>();

  /** Cached per-(id,width) Observable instances — stable references for async pipe. */
  private widthObservables = new Map<string, Observable<string | null>>();

  constructor(private client: RijksLinkedArtClient) {}

  /**
   * Returns the IIIF image URL for an object, resized to the requested width.
   * Emits `null` if the chain has no image (e.g. object has no `shows` entry).
   *
   * Successive calls for the same (id, width) return the **same** Observable
   * instance — important for change-detection-heavy contexts (e.g. async pipe
   * inside *ngFor with 100 tiles).
   */
  getImageUrl(objectIdOrUrl: string, width: number = 500): Observable<string | null> {
    if (!objectIdOrUrl) {
      return of(null);
    }
    const idKey = this.client.extractNumericId(objectIdOrUrl);
    const cacheKey = `${idKey}@${width}`;

    const existing = this.widthObservables.get(cacheKey);
    if (existing) {
      return existing;
    }

    const observable = this.subjectFor(idKey).pipe(map((url) => this.applyWidth(url, width)));
    this.widthObservables.set(cacheKey, observable);
    return observable;
  }

  /** Bulk pre-warm: kicks off resolution for many ids in parallel (no awaiting). */
  preload(objectIds: string[]): void {
    for (const id of objectIds) {
      this.subjectFor(this.client.extractNumericId(id));
    }
  }

  /** Clears the cache. Use on new search to free memory. */
  reset(): void {
    this.baseSubjects.clear();
    this.widthObservables.clear();
  }

  /** Returns (or creates) the shared base-URL subject for an object id. */
  private subjectFor(idKey: string): ReplaySubject<string | null> {
    const cached = this.baseSubjects.get(idKey);
    if (cached) {
      return cached;
    }
    const subject = new ReplaySubject<string | null>(1);
    this.baseSubjects.set(idKey, subject);

    this.resolveBaseUrl(idKey).subscribe(
      (url) => {
        subject.next(url);
        subject.complete();
      },
      () => {
        subject.next(null);
        subject.complete();
      },
    );
    return subject;
  }

  // ===== internals =====

  private resolveBaseUrl(numericObjectId: string): Observable<string | null> {
    return this.client.getHumanMadeObject(numericObjectId).pipe(
      switchMap((obj) => {
        const visualUrl = obj.shows?.[0]?.id;
        if (!visualUrl) {
          return of<string | null>(null);
        }
        return this.client.getVisualItem(this.client.extractNumericId(visualUrl));
      }),
      switchMap((vi) => {
        if (!vi || typeof vi === 'string') {
          return of<string | null>(null);
        }
        const digitalUrl = (vi as any).digitally_shown_by?.[0]?.id;
        if (!digitalUrl) {
          return of<string | null>(null);
        }
        return this.client.getDigitalObject(this.client.extractNumericId(digitalUrl));
      }),
      map((digital) => {
        if (!digital || typeof digital === 'string') {
          return null;
        }
        return (digital as any).access_point?.[0]?.id || null;
      }),
      catchError(() => of<string | null>(null)),
    );
  }

  /**
   * Rewrites an IIIF base URL with explicit width.
   * Input:  https://iiif.micr.io/{id}/full/max/0/default.jpg
   * Output: https://iiif.micr.io/{id}/full/{width},/0/default.jpg
   */
  private applyWidth(url: string | null, width: number): string | null {
    if (!url) {
      return null;
    }
    return url.replace(/\/full\/[^/]+\/0\/default\.(jpg|png)$/i, `/full/${Math.round(width)},/0/default.$1`);
  }
}
