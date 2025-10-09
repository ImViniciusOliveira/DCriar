import { Hateoas } from '../../../core/models/hateoas.model';
import { PageInfo } from '../../products/models/products.model';

export interface MaterialType extends Hateoas {
  id: number;
  nome: string;
  unidadeDeConsumo: string;
}

export interface ApiResponseMaterialTypes extends Hateoas {
  _embedded?: { 'tipos-materia-prima': MaterialType[] };
}

export interface PagedMaterialTypesResponse {
  _embedded: {
    'tipos-materia-prima': MaterialType[];
  };
  page: PageInfo;
  _links: Hateoas['_links'];
}
