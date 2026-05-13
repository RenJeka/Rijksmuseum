# Refactoring plan: migration to the new Rijksmuseum API

## Context

The old REST API `https://www.rijksmuseum.nl/api/en/collection?key=...` returns **410 Gone** — Rijksmuseum migrated to the new Linked Data platform `https://data.rijksmuseum.nl`. The old data model (flat JSON with full fields) is no longer available.

New API:
- **Search** returns only a list of Linked Open Data IDs (without images and titles)
- Object data is spread across three resources: `HumanMadeObject` → `VisualItem` → `DigitalObject` → IIIF URL
- Token-based pagination (fixed at 100/page, no page numbers)
- No API key required
- CORS does not block requests from `localhost`

This means that refactoring affects `DataService`, `PaginationService`, `i*.ts` interfaces, as well as the search UI and pagination in `MainComponent`.

**Intention:** minimize changes in templates via **Adapter pattern** — convert Linked Art JSON into existing `IArtObject` / `IArtObjectDetails`, so that `*.html` files hardly change.

**Feature budget (agreed with the project owner):**
- Sorting — remove from UI (API does not support it)
- Color filter — remove from UI (API does not support it)
- Pagination — simplify to Prev/Next + counter
- Images — lazy + batching via `IntersectionObserver`

---

## Target architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Components (minimal UI changes)          │
│  MainComponent | PopupComponent | DetailsComponent          │
└────────────────────────────┬────────────────────────────────┘
                             │ (read IArtObject/IArtObjectDetails)
┌────────────────────────────┴────────────────────────────────┐
│        DataService (facade — public API is almost the same) │
│ getCollection() | searchCollection() | searchByTag() | ...  │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────┐
│ RijksLinkedArtClient (new) — low-level HTTP requests        │
│ searchCollection() → OrderedCollectionPage                  │
│ getHumanMadeObject(id) | getVisualItem(id) | …              │
│ resolveImageUrl(objectId): Observable<string>               │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────┐
│ LinkedArtAdapter (new) — Linked Art → IArtObject conversion │
│ mapHumanMadeObjectToArtObject()                             │
│ mapToArtObjectDetails()                                     │
│ extractTitle() | extractCreator() | extractDimensions() ... │
└─────────────────────────────────────────────────────────────┘
```

---

## Files

### New

| File | Purpose |
|------|-------------|
| `src/app/shared/api/rijks-linked-art.client.ts` | HTTP client for `data.rijksmuseum.nl` |
| `src/app/shared/api/linked-art.adapter.ts` | Linked Art JSON → `IArtObject` / `IArtObjectDetails` conversion |
| `src/app/shared/api/linked-art-types.ts` | Minimal TypeScript types for Linked Art (only what we read) |
| `src/app/shared/api/image-loader.service.ts` | Lazy/batched image URL resolution with in-memory cache |

### Modified

| File | Changes |
|------|-------|
| `src/app/shared/data.service.ts` | Replace HTTP calls with `RijksLinkedArtClient`. Keep public API where possible. Remove `apiKey`, `allowedSortTypes` validation, color/period validation. |
| `src/app/shared/pagination.service.ts` | Replace `BehaviorSubject<IPaginatorSettings>` (page numbers) with `BehaviorSubject<IPaginatorState>` (tokens). Remove `changePage`, `goToStart`, `goToFinish`, `changeResultsPerPage`, `maximumObjects`, `getMaximumPage`, `paging[]`. Leave `goNext()`, `goPrev()`. |
| `src/app/shared/ipaginator-settings.ts` | New format (token + counts) — see the «Pagination» section |
| `src/app/shared/iart-object.ts` | Make optional fields that do not always come now (`hasImage`, `permitDownload`, `productionPlaces`, `links`) |
| `src/app/shared/iart-collection.ts` | Remove `facets[]`, `countFacets`, `elapsedMilliseconds` (new API does not return them) |
| `src/app/main/main.component.html` | Remove sorting dropdown, color filter, «objects per page» dropdown, numbered pagination. Add simple Prev/Next + «Page N of M • X total» counter. |
| `src/app/main/main.component.ts` | Remove sort/color/ps handlers. |
| `src/app/main/main.component.scss` | Clean up styles of removed elements |
| `src/app/details/details.component.html` | Protect optional fields with `?.` and `*ngIf` (in Linked Art some fields may be missing for some objects) |
| `src/app/**/*.html` | Migrate `[src]="dataService.getImageById(id)"` to `[src]="dataService.getImageById(id) | async"` — because the method now returns `Observable<string\|null>` |
| `package.json` | Remove `--proxy-config proxy.conf.json` from `start` (CORS is no longer an issue) |
| `proxy.conf.json` | **Delete** (CORS is allowed in the new API) |
| `README.md` | Update Troubleshooting section (remove CORS-fix, add description of new pipeline) |
| `CLAUDE.md` | Update: new endpoint, new data model, no API key |

### Deleted

- `proxy.conf.json`
- `src/app/shared/ng-for-with-numbers.directive.ts` — only used for numbered pagination, which is being removed; remove from `app.module.ts` declarations

---

## Field Mapping: Linked Art → IArtObject

| `IArtObject` field | Path in Linked Art JSON |
|-------------------|------------------------|
| `id` | `data.id` (LOD URI) |
| `objectNumber` | `data.identified_by[]` where `classified_as[].id = http://vocab.getty.edu/aat/300312355` (object number) |
| `title` | `data.identified_by[]` where `type=Name`, language en (`language[].id = http://vocab.getty.edu/aat/300388277`) |
| `longTitle` | `${title}, ${creator}, ${year}` |
| `principalOrFirstMaker` | `data.produced_by.part[].carried_out_by[].identified_by[].content` (language en) |
| `webImage.url`, `headerImage.url` | via `ImageLoaderService.resolveImageUrl(objectId)` — IIIF base + size |
| `materials[]` | `data.made_of[].identified_by[].content` (en) |
| `dating.presentingDate` | `data.produced_by.timespan.identified_by[].content` |
| `subTitle` (dimensions) | concatenation `data.dimension[].value + " " + unit._label` |
| `description` | `data.subject_of[].part[].content` where `classified_as` description |
| `scLabelLine` | `data.subject_of[].part[].content` where `classified_as` label |
| `classification.iconClassDescription[]` | `data.shows[0]` → VisualItem.`represents_instance_of_type[].equivalent[].id` (iconclass.org) |

**Language filter:** default — English (`aat/300388277`). Fallback to Dutch (`aat/300388256`) if English is missing. Move to helper `pickLocalized(items, lang='en')`.

---

## Image Strategy

```
resolveImageUrl(objectId): Observable<string>
  if cache.has(objectId): return of(cache.get(objectId))

  return getHumanMadeObject(objectId).pipe(
    switchMap(obj => {
      visualId = numericPart(obj.shows[0].id)
      return getVisualItem(visualId)
    }),
    switchMap(vi => {
      digitalId = numericPart(vi.digitally_shown_by[0].id)
      return getDigitalObject(digitalId)
    }),
    map(digital => digital.access_point[0].id),  // IIIF max URL
    tap(url => cache.set(objectId, url))
  )
```

**Lazy loading:**
- `IntersectionObserver` on each grid card
- Card enters viewport → `resolveImageUrl()`
- Batching: accumulate requests in a 50ms window, send `forkJoin` in groups of 6-10
- Before loading — placeholder (CSS skeleton)

**IIIF dimensions (URL pattern `https://iiif.micr.io/{id}/full/{size}/0/default.jpg`):**
- Grid thumb: `/full/500,/0/default.jpg`
- Popup: `/full/800,/0/default.jpg`
- Details: `/full/1200,/0/default.jpg`

`DataService.getImageById()` changes signature from `string|null` to `Observable<string|null>` — this is a **breaking** change for templates. Use `| async` pipe everywhere in HTML.

---

## Search parameters: mapping

| Old `urlQueryParams` | New Search API | Action |
|--------------------------|-------------------|-----|
| `key` | — | remove |
| `q` (keyword) | `title` | search by title |
| `s` (sort) | — | **remove from UI** |
| `imgonly=True` | `imageAvailable=true` | always true |
| `type` | `type` | 1:1 mapping |
| `material` | `material` | 1:1 mapping |
| `technique` | `technique` | 1:1 mapping |
| `f.dating.period` (1-21) | `creationDate` (wildcard) | **remove from UI** (no simple mapping) |
| `f.normalized32Colors.hex` | — | **remove from UI** |
| `p` (page #) | `pageToken` | from previous response |
| `ps` (per page) | — | fixed at 100 |

---

## Pagination: new model

```ts
// src/app/shared/ipaginator-settings.ts
export interface IPaginatorState {
  totalItems: number;            // partOf.totalItems
  currentPageToken: string|null; // null for the first page
  nextPageToken: string|null;    // from next.id (parse query string)
  prevPageToken: string|null;    // from prev.id
  currentPageNumber: number;     // 1-based counter, +1 on goNext
  pageSize: 100;                 // const
}
```

`PaginationService` API:
- `goNext()` — set `currentPageToken = nextPageToken`, `currentPageNumber++`
- `goPrev()` — set `currentPageToken = prevPageToken`, `currentPageNumber--`
- `reset()` — `currentPageToken=null`, `currentPageNumber=1` (for new search)
- `paginatorStream$: Observable<IPaginatorState>`

UI:
```
[ ← Prev ]   Page 3 of 50   •   4912 total   [ Next → ]
```

---

## Implementation phases

1. **Foundation (without breaking existing code):**
   - Add `linked-art-types.ts`, `RijksLinkedArtClient`, `LinkedArtAdapter`, `ImageLoaderService`
   - At this stage old code will not work (because API 410), but infrastructure for the new one is ready

2. **DataService switch:**
   - Replace `getCollection()` with a new pipeline (Search → map IDs → batch resolve via adapter)
   - Replace `getArtObjectDetail()` with resolving details of a single object via client + adapter
   - `getImageById()` → `Observable<string|null>`
   - Remove `apiKey`, validation for sort/color/period

3. **PaginationService refactor:**
   - New `IPaginatorState`
   - Remove legacy methods
   - Subscription in `DataService.constructor` — to the new schema

4. **UI updates:**
   - `main.component.html`: remove color picker, sort dropdown, results-per-page dropdown, numbered pagination
   - Add Prev/Next + counter
   - Replace all `[src]="getImageById(id)"` with `... | async`
   - Add CSS placeholder for un-loaded images
   - `details.component.html`: defensive `?.` + `*ngIf` for optional fields

5. **Cleanup:**
   - Remove `proxy.conf.json`, remove `--proxy-config` from `package.json`
   - Remove `NgForWithNumbersDirective` (declarations in `app.module.ts`)
   - README: rewrite Troubleshooting section
   - CLAUDE.md: update "High-level architecture", remove `apiKey`-note

---

## Verification

**Start dev server and verify in browser:**
```bash
npm start
```

**Functionality checklist:**
1. Main page loads grid with 100 objects (lazy images)
2. Search by keyword — returns objects with match in title
3. Search by material (click on material in details) — filters
4. Search by category (iconclass) — filters
5. Pagination Prev/Next — moves through pages, counter is correct
6. Popup open (click on object) — details without leaving the list
7. Details page — full page with fields (defensive `?.` for missing ones)
8. Favorites toggle (heart icon) — adding/removing, viewing "Favorites only"
9. Error page on invalid route

**Technical check:**
```bash
npm run build    # without errors and critical warnings
npm run lint     # TSLint clean
```

**Playwright spot-check:**
- Console: 0 CORS-errors
- Network: requests to `https://data.rijksmuseum.nl/...` (not to `www.rijksmuseum.nl/api/...`)
- Images load on scroll (visible in Network tab)

---

## Risks / open questions

- **Linked Art JSON structure** — unstable, can vary between objects. Adapter must be defensive (everywhere `?.`, safe `[]` fallback).
- **IIIF micr.io** — third party. If it is down — images disappear. Optional fallback: `subject_of.digitally_carried_by.access_point` (museum HTML page).
- **Image cache in-memory** — lost after refresh. If persistent is needed — add IndexedDB (out of scope).
- **Tests are practically absent** — `skipTests: true` in `angular.json`. Adapter coverage with unit tests — a separate task, useful, but does not block release.
- **Other languages** — currently hardcoded en/nl. If needed to expand — move to config.
