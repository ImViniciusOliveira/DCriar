import { Hateoas } from '../../../core/models/hateoas.model';

export interface MaterialType extends Hateoas {
  id: number;
  nome: string;
  unidadeDeConsumo: string;
}

export interface EmbeddedMaterialTypes {
  'tipos-materia-prima': MaterialType[];
}

export interface ApiResponseMaterialTypes extends Hateoas {
  _embedded: EmbeddedMaterialTypes;
}
