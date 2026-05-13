import {IArtObject} from 'src/app/shared/iart-object';

export interface IArtCollection {
  artObjects: IArtObject[];
  count: number;
}
