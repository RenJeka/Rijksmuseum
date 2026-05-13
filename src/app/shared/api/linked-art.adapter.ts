import {Injectable} from '@angular/core';

import {IArtObject} from 'src/app/shared/iart-object';
import {IArtObjectDetails} from 'src/app/shared/iart-object-details';
import {
  AAT_DESCRIPTION,
  AAT_LANG_EN,
  AAT_LANG_NL,
  AAT_OBJECT_IDENTIFIER,
  AAT_TITLE,
  LAClassifiedItem,
  LADimension,
  LAHumanMadeObject,
  LAName,
  LARef,
  LASubjectOf,
  LAVisualItem,
} from 'src/app/shared/api/linked-art-types';

/**
 * Converts Linked Art JSON (Rijksmuseum new API) into the legacy IArtObject /
 * IArtObjectDetails shapes used by templates and components.
 *
 * Adapter is intentionally defensive — Linked Art fields are optional and vary
 * between objects. Missing fields surface as null / empty arrays, not crashes.
 */
@Injectable({providedIn: 'root'})
export class LinkedArtAdapter {

  /**
   * Build a lightweight IArtObject (for grid tiles). webImage / headerImage URLs
   * are filled in lazily by ImageLoaderService — left empty here.
   */
  mapHumanMadeObjectToArtObject(la: LAHumanMadeObject): IArtObject {
    const title = this.extractTitle(la);
    const creator = this.extractCreator(la);
    const year = this.extractYear(la);
    const objectNumber = this.extractObjectNumber(la) || this.extractNumericId(la.id);

    return {
      id: la.id,
      objectNumber,
      title,
      longTitle: this.buildLongTitle(title, creator, year),
      principalOrFirstMaker: creator,
      hasImage: !!(la.shows && la.shows.length),
      headerImage: this.emptyImage(),
      webImage: this.emptyImage(),
      permitDownload: true,
      productionPlaces: [],
      showImage: true,
      links: {self: la.id, web: ''},
    };
  }

  /** Full details for popup/details pages. */
  mapToArtObjectDetails(la: LAHumanMadeObject, visual?: LAVisualItem | null): IArtObjectDetails {
    const title = this.extractTitle(la);
    const creator = this.extractCreator(la);
    const year = this.extractYear(la);
    const objectNumber = this.extractObjectNumber(la) || this.extractNumericId(la.id);
    const description = this.extractDescription(la);
    const materials = this.extractMaterials(la);
    const dimensions = this.extractDimensionsString(la);

    return {
      artObject: {
        id: la.id,
        objectNumber,
        title,
        longTitle: this.buildLongTitle(title, creator, year),
        principalMaker: creator,
        scLabelLine: this.extractScLabel(la),
        subTitle: dimensions,
        description,
        plaqueDescriptionEnglish: this.extractPlaqueDescription(la),
        materials,
        objectTypes: this.extractObjectTypes(la),
        documentation: [],
        dating: {
          period: 0,
          presentingDate: year,
          sortingDate: parseInt(year, 10) || 0,
          yearEarly: parseInt(year, 10) || 0,
          yearLate: parseInt(year, 10) || 0,
        },
        dimensions: this.extractDimensionsArray(la),
        classification: {
          events: [],
          iconClassDescription: this.extractIconClasses(visual),
        },
        label: {
          date: year,
          description,
          makerLine: creator,
          notes: '',
          title,
        },
        links: {search: ''},
        webImage: {
          guid: '',
          height: 0,
          offsetPercentageX: 0,
          offsetPercentageY: 0,
          url: '',
          width: '',
        },
      },
      artObjectPage: {},
    };
  }

  // ===== field extractors =====

  extractTitle(la: LAHumanMadeObject): string {
    if (!la.identified_by) {
      return '';
    }
    const titleNames = la.identified_by.filter((n) =>
      this.classifiedAsAny(n, [AAT_TITLE]) || (n.type === 'Name')
    );
    return this.pickLocalizedContent(titleNames) || this.pickLocalizedContent(la.identified_by) || '';
  }

  extractCreator(la: LAHumanMadeObject): string {
    const parts = la.produced_by?.part || [];
    for (const part of parts) {
      const actor = (part.carried_out_by || [])[0] as { identified_by?: LAName[]; _label?: string } | undefined;
      if (!actor) {
        continue;
      }
      const name = this.pickLocalizedContent(actor.identified_by || []);
      if (name) {
        return name;
      }
      if (actor._label) {
        return actor._label;
      }
    }
    const direct = la.produced_by?.carried_out_by?.[0];
    if (direct) {
      return this.pickLocalizedContent(direct.identified_by || []) || direct._label || '';
    }
    return '';
  }

  extractYear(la: LAHumanMadeObject): string {
    const names = la.produced_by?.timespan?.identified_by || [];
    return this.pickLocalizedContent(names) || '';
  }

  extractObjectNumber(la: LAHumanMadeObject): string {
    if (!la.identified_by) {
      return '';
    }
    for (const item of la.identified_by) {
      if (this.classifiedAsAny(item, [AAT_OBJECT_IDENTIFIER]) && item.content) {
        return item.content;
      }
      // nested identifier
      if (item.identified_by) {
        for (const inner of item.identified_by) {
          if (this.classifiedAsAny(inner, [AAT_OBJECT_IDENTIFIER]) && inner.content) {
            return inner.content;
          }
        }
      }
    }
    return '';
  }

  extractDescription(la: LAHumanMadeObject): string {
    const parts = this.flattenLinguisticParts(la.subject_of);
    const descPart = parts.find((p) => this.classifiedAsAny(p, [AAT_DESCRIPTION]));
    if (descPart?.content) {
      return descPart.content;
    }
    return '';
  }

  extractScLabel(la: LAHumanMadeObject): string {
    const parts = this.flattenLinguisticParts(la.subject_of);
    // Heuristic: first textual part that is NOT description and has content
    for (const p of parts) {
      if (p.content && !this.classifiedAsAny(p, [AAT_DESCRIPTION])) {
        return p.content;
      }
    }
    return '';
  }

  extractPlaqueDescription(la: LAHumanMadeObject): string {
    // Plaque-style English text is typically a linguistic object under subject_of
    // with content paragraph. Fallback: same as description if nothing else.
    const parts = this.flattenLinguisticParts(la.subject_of)
      .filter((p) => !!p.content);
    const en = parts.find((p) => this.isEnglish(p));
    if (en?.content) {
      return en.content;
    }
    return '';
  }

  extractMaterials(la: LAHumanMadeObject): string[] {
    const items = la.made_of || [];
    const out: string[] = [];
    for (const m of items) {
      // Linked Art "made_of" has notation[] with language-tagged labels
      // Adapter just picks the first non-empty string label.
      const label = m._label
        || (m.equivalent && this.firstString(m.equivalent))
        || '';
      if (label) {
        out.push(label);
      }
    }
    return out;
  }

  extractObjectTypes(la: LAHumanMadeObject): string[] {
    const items = la.classified_as || [];
    return items
      .map((c) => c._label || '')
      .filter((s) => !!s);
  }

  extractIconClasses(visual: LAVisualItem | null | undefined): string[] {
    if (!visual?.represents_instance_of_type) {
      return [];
    }
    const out: string[] = [];
    for (const t of visual.represents_instance_of_type) {
      const label = t._label;
      if (label) {
        out.push(label);
        continue;
      }
      // fallback: pick iconclass.org URI suffix
      const eq = (t.equivalent || []).map((e) => (typeof e === 'string' ? e : e.id || '')).filter(Boolean);
      const icon = eq.find((u) => u.includes('iconclass.org'));
      if (icon) {
        out.push(icon.split('/').pop() || icon);
      }
    }
    return out;
  }

  extractDimensionsArray(la: LAHumanMadeObject): Array<{ part: any; type: string; unit: string; value: string }> {
    return (la.dimension || []).map((d) => ({
      part: null,
      type: d._label || '',
      unit: d.unit?._label || '',
      value: d.value || '',
    }));
  }

  extractDimensionsString(la: LAHumanMadeObject): string {
    return this.extractDimensionsArray(la)
      .map((d) => `${d.type ? d.type + ': ' : ''}${d.value}${d.unit ? ' ' + d.unit : ''}`)
      .filter(Boolean)
      .join(', ');
  }

  // ===== helpers =====

  buildLongTitle(title: string, creator: string, year: string): string {
    return [title, creator, year].filter(Boolean).join(', ');
  }

  /** Picks the first content with English language tag, falling back to Dutch, then first non-empty. */
  pickLocalizedContent(items: Array<{ content?: string; language?: Array<{ id?: string }> }> = []): string {
    const en = items.find((it) => this.isEnglish(it) && !!it.content);
    if (en?.content) {
      return en.content;
    }
    const nl = items.find((it) => this.isDutch(it) && !!it.content);
    if (nl?.content) {
      return nl.content;
    }
    const any = items.find((it) => !!it.content);
    return any?.content || '';
  }

  private isEnglish(item: { language?: Array<{ id?: string }> }): boolean {
    return (item.language || []).some((l) => l.id === AAT_LANG_EN);
  }

  private isDutch(item: { language?: Array<{ id?: string }> }): boolean {
    return (item.language || []).some((l) => l.id === AAT_LANG_NL);
  }

  private classifiedAsAny(item: LAClassifiedItem, aatIds: string[]): boolean {
    const classes = item.classified_as || [];
    return classes.some((c) => {
      const id = typeof c === 'string' ? c : c.id || '';
      return aatIds.indexOf(id) >= 0;
    });
  }

  private flattenLinguisticParts(items: LASubjectOf[] | undefined): Array<{ content?: string; classified_as?: any; language?: Array<{ id?: string }> }> {
    if (!items) {
      return [];
    }
    const out: any[] = [];
    const walk = (arr: any[]) => {
      for (const x of arr) {
        out.push(x);
        if (x.part && Array.isArray(x.part)) {
          walk(x.part);
        }
      }
    };
    walk(items);
    return out;
  }

  private firstString(arr: Array<string | LARef>): string {
    for (const v of arr) {
      if (typeof v === 'string') {
        return v;
      }
      if (v && v.id) {
        return v.id;
      }
    }
    return '';
  }

  /** Extracts trailing numeric id from a LOD URL. */
  extractNumericId(idOrUrl: string): string {
    if (!idOrUrl) {
      return idOrUrl;
    }
    const match = idOrUrl.match(/\/(\d+)(?:\?.*)?$/);
    return match ? match[1] : idOrUrl;
  }

  private emptyImage() {
    return {
      guid: '',
      height: 0,
      offsetPercentageX: 0,
      offsetPercentageY: 0,
      url: '',
      width: 0,
    };
  }
}
