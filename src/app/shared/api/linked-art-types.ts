/**
 * Minimal TypeScript types for Linked Art JSON returned by data.rijksmuseum.nl.
 * Only fields that we actually read are typed — the full spec is huge.
 *
 * Spec reference: https://linked.art/api/1.0/
 */

export const AAT_LANG_EN = 'http://vocab.getty.edu/aat/300388277';
export const AAT_LANG_NL = 'http://vocab.getty.edu/aat/300388256';
export const AAT_OBJECT_IDENTIFIER = 'http://vocab.getty.edu/aat/300312355';
export const AAT_DESCRIPTION = 'http://vocab.getty.edu/aat/300048722';
export const AAT_TITLE = 'http://vocab.getty.edu/aat/300417207';

export interface LARef {
  id?: string;
  type?: string;
  _label?: string;
}

export interface LATypeRef extends LARef {
  equivalent?: Array<string | LARef>;
}

export interface LALanguage extends LARef {
  id?: string;
}

export interface LAClassifiedItem extends LARef {
  classified_as?: Array<string | LARef>;
  language?: LALanguage[];
}

export interface LAIdentifier extends LAClassifiedItem {
  content?: string;
}

export interface LAName extends LAClassifiedItem {
  content?: string;
  identified_by?: LAIdentifier[];
}

export interface LALinguisticObject extends LAClassifiedItem {
  content?: string;
  part?: LALinguisticObject[];
  language?: LALanguage[];
}

export interface LADimension extends LARef {
  value?: string;
  unit?: LARef;
  classified_as?: Array<string | LARef>;
  identified_by?: LAIdentifier[];
}

export interface LATimespan extends LARef {
  identified_by?: LAName[];
  begin_of_the_begin?: string;
  end_of_the_end?: string;
}

export interface LAProductionPart extends LARef {
  carried_out_by?: LAIdentifier[] & Array<{
    identified_by?: LAName[];
    _label?: string;
  }>;
  classified_as?: Array<string | LARef>;
  technique?: LATypeRef[];
  identified_by?: LAName[];
}

export interface LAProduction extends LARef {
  part?: LAProductionPart[];
  carried_out_by?: Array<{ identified_by?: LAName[]; _label?: string }>;
  timespan?: LATimespan;
  technique?: LATypeRef[];
}

export interface LADigitalObjectRef extends LARef {
  id?: string;
  type?: string;
  access_point?: LARef[];
  format?: string;
}

export interface LASubjectOfPart extends LALinguisticObject {
  digitally_carried_by?: LADigitalObjectRef[];
  part?: LASubjectOfPart[];
}

export interface LASubjectOf extends LALinguisticObject {
  digitally_carried_by?: LADigitalObjectRef[];
  part?: LASubjectOfPart[];
}

export interface LAHumanMadeObject {
  '@context'?: string;
  id: string;
  type: 'HumanMadeObject';
  _label?: string;
  identified_by?: LAName[];
  classified_as?: LATypeRef[];
  produced_by?: LAProduction;
  shows?: LARef[];
  subject_of?: LASubjectOf[];
  made_of?: LATypeRef[];
  dimension?: LADimension[];
  current_location?: LARef;
  referred_to_by?: LALinguisticObject[];
  equivalent?: LARef[];
  member_of?: LARef[];
}

export interface LAVisualItem {
  '@context'?: string;
  id: string;
  type: 'VisualItem';
  represents_instance_of_type?: LATypeRef[];
  shown_by?: LARef[];
  digitally_shown_by?: LARef[];
  subject_of?: LASubjectOf[];
}

export interface LADigitalObject {
  '@context'?: string;
  id: string;
  type: 'DigitalObject';
  access_point?: LARef[];
  digitally_shows?: LARef[];
  referred_to_by?: LALinguisticObject[];
}

/** Search response (linked.art OrderedCollection). */
export interface SearchOrderedCollectionPage {
  '@context'?: string;
  id: string;
  type: 'OrderedCollectionPage';
  partOf?: {
    id: string;
    type: 'OrderedCollection';
    totalItems: number;
    first?: { id: string };
    last?: { id: string };
  };
  next?: { id: string };
  prev?: { id: string };
  orderedItems: Array<{ id: string; type: string }>;
}

/** Parameters supported by data.rijksmuseum.nl/search/collection */
export interface SearchParams {
  type?: string;
  material?: string;
  technique?: string;
  title?: string;
  description?: string;
  creator?: string;
  imageAvailable?: 'true' | 'false';
  creationDate?: string;
  objectNumber?: string;
  aboutActor?: string;
  pageToken?: string;
}
