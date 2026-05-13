# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project context

A demo application on Angular 9 that shows the art collection of the Rijksmuseum via the official Linked Data API. The stack was chosen as of 2023 and intentionally does not use third-party UI/state libraries — only `@angular/*`, `rxjs`, and custom services/directives.

- Official API documentation: https://data.rijksmuseum.nl/docs/
- Search API: https://data.rijksmuseum.nl/docs/search
- Linked Data Resolver: https://data.rijksmuseum.nl/docs/http
- IIIF Image API: https://data.rijksmuseum.nl/docs/iiif/image
- Technical requirements for the project are located in `src/assets/technical_requirements_Rijksmuseum.pdf`.
- Migration plan from the old REST API to the new Linked Data platform — `docs/plans/renovate_api_architecture.md`.

API key is not required. The old REST endpoint `https://www.rijksmuseum.nl/api/en/collection?key=...` returns **410 Gone** since 2025 — the application migrated to `https://data.rijksmuseum.nl` (Linked Art JSON). CORS is allowed from any origin, dev-proxy is not needed.

## Common commands

```bash
npm start        # ng serve → http://localhost:4200
npm run build    # ng build (prod config via --configuration production)
npm test         # ng test — Karma + Jasmine, watch mode
npm run lint     # ng lint — TSLint (codelyzer), see tslint.json
npm run e2e      # Protractor, config in e2e/protractor.conf.js
```

Run a single test: `ng test --include='**/path/to/file.spec.ts'`. Currently, test files are practically absent in the repository (schematics are configured with `skipTests: true` in `angular.json`), so adding `.spec.ts` is a separate task.

Versions in `package.json` are pinned to Angular 9.1 / TypeScript 3.8 / RxJS 6.5. Before updating packages, coordinate with the user first — the stack is intentionally "frozen" since 2023.

## High-level architecture

Classic Angular CLI structure with a single root `AppModule` (`src/app/app.module.ts`). There are no feature modules or lazy-loading — all components, directives, and services are declared at the root.

### Routing (`app-routing.module.ts`)

`MainComponent` is a layout shell with its own `<router-outlet>`. `PopupComponent` and `DetailsComponent` are rendered **as children of `MainComponent`**, so when opening image details, the user does not leave the main grid:

- `/` → `MainComponent` (list + filters + pagination)
  - `popup/:objNumber` → `PopupComponent` (quick view over the grid)
  - `detail/:objNumber` → `DetailsComponent` (full page with details)
- `/error` → `ErrorPageComponent`, other paths redirect here.

### API layer — `src/app/shared/api/`

The Linked Art API is divided into three levels:

- `RijksLinkedArtClient` (`rijks-linked-art.client.ts`) — low-level HTTP calls to `data.rijksmuseum.nl`: `searchCollection()`, `getHumanMadeObject()`, `getVisualItem()`, `getDigitalObject()`. No API key, no CORS issues.
- `LinkedArtAdapter` (`linked-art.adapter.ts`) — conversion of Linked Art JSON (nested `identified_by`, `produced_by`, `subject_of`, …) into flat `IArtObject` / `IArtObjectDetails` consumed by templates. The adapter is intentionally defensive — most fields are optional, language fallback en → nl.
- `ImageLoaderService` (`image-loader.service.ts`) — resolves image URLs using a three-step chain `HumanMadeObject → VisualItem → DigitalObject → access_point`. Lazy (only when needed), caches per `(objectId, width)` `Observable<string|null>` for the stability of the async-pipe in *ngFor.

### Application state — on `DataService` (`src/app/shared/data.service.ts`)

`DataService` is a facade over the API layer. It:
- holds `searchState` (q, type, material, technique, creator, creationDate) in a private field;
- holds the current collection (`artCollection`, `artObjects`), details of the active object (`currentArtObjectDetails`), favorites (`favoriteArtCollection`), and loading flags;
- subscribes to `paginationService.pageChange$` in the constructor — any page change (goNext/goPrev/reset) triggers a new request. **To reload the list — change the state via `PaginationService`** (or via `applySearch()` / `searchByTag()`), and do not call `getCollection()` directly;
- `applySearch({keyword, creator, type, creationDate})` — the main form search, combines all four API filters and resets pagination. `searchCollection()` kept for backward compatibility (called from `details.component` when clicking a category tag); `searchByTag({material, technique, type})` for tag-clicks from the details page;
- `getCollection()` makes a Search request, then in parallel (`forkJoin`) resolves 100 `HumanMadeObject`s for names. Images are separated, lazy via `ImageLoaderService`;
- `getImageById(id, width)` returns **`Observable<string|null>`** (not string!), because resolution is asynchronous — use `| async` in templates;
- caches details: `setupOnInitComponents` returns cached `currentArtObjectDetails` if the `objectNumber` matches, otherwise makes a new request.

The `favoriteArtCollection` cache lives only in memory — it is lost after a reload. If a task requires persistence, it needs to be done explicitly (localStorage, etc.).

### Pagination — on `PaginationService` (`src/app/shared/pagination.service.ts`)

The new API supports **only** token-based pagination (fixed 100 objects/page). `paginatorStream$: BehaviorSubject<IPaginatorState>` holds `{totalItems, currentPageToken, nextPageToken, prevPageToken, currentPageNumber, pageSize}`. UI methods: `goNext()`, `goPrev()`, `reset()`. `applySearchResponse(next, prev, total)` is called by `DataService` after each response and updates the tokens.

Page numbers, results-per-page, and "jump to page N" are not available — the API does not return this information.

### Dynamic greeting modal window

`AppComponent` creates `GreetingComponent` via `ComponentFactoryResolver` + `RefDirective` (`[appRef]` in `app.component.html`). This is an intentional example of a "manual" dynamic component without `*ngIf` and without `entryComponents` (commented out — Angular 9 with Ivy no longer requires them). When changing the greeting flow, keep this pattern or change it to a modern modal pattern in both places.

### Custom directives

- `ImageScaleDirective` — applied to image cards for a UI scaling effect on hover.
- `NgForWithNumbersDirective` — custom structural `*ngFor`-like rendering by the number of iterations (currently used for a skeleton grid at the start of loading).
- `RefDirective` — anchor for dynamic-component injection (see greeting modal above).

### Interfaces

Internal (flat) models — `src/app/shared/i*.ts`: `IArtCollection`, `IArtObject`, `IArtObjectDetails`, `IArtObjectImage`, `IPaginatorState`. Components read **them**, not the raw Linked Art JSON — this is done by `LinkedArtAdapter`.

Linked Art types (minimal, only required fields) — `src/app/shared/api/linked-art-types.ts`. If the adapter needs to read a new field — add it here defensive optional, do not reverse the entire Linked Art spec.

## Style / build conventions

- SCSS variables are centralized in `src/stylings/_variables.scss`. The file is included as `stylePreprocessorOptions.includePaths` in `angular.json`, so in any `.scss` you can write `@import 'variables';` without a path.
- TS imports are written with the absolute prefix `src/app/...` (not with `./` or `../`). Stick to this style when adding files.
- `angular.json` schematics are set to `style: scss` and `skipTests: true` — generated code does not create `.spec.ts`/`.css` by default.
- TSLint config — `tslint.json` (codelyzer). This is legacy for Angular 9; not yet migrated to ESLint.
- Production build has budgets: `initial` warn 2mb / err 5mb, `anyComponentStyle` warn 6kb / err 10kb. If component styles exceed 10kb — move a part into global `styles.scss` or into shared SCSS.
