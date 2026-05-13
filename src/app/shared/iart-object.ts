import {IArtObjectImage} from 'src/app/shared/iart-object-image';

export interface IArtObject {
  id: string;
  objectNumber: string;
  title: string;
  longTitle: string;
  principalOrFirstMaker: string;
  hasImage?: boolean;
  headerImage?: IArtObjectImage;
  webImage?: IArtObjectImage;
  permitDownload?: boolean;
  productionPlaces?: string[];
  showImage?: boolean;
  links?: {
    self: string;
    web: string;
  };
}
