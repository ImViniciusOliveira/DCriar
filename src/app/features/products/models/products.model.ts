import { Hateoas } from '../../../core/models/hateoas.model';
import { MaterialType } from '../../stock/models/material-type.model';

export interface DimensionsUnitarias {
  larguraCm: number;
  comprimentoCm: number;
}

export interface Product extends Hateoas {
  id: number;
  nome: string;
  sku: string;
  descricao: string;
  cor: string;
  unidadesPorProduto: number;
  ativo: boolean;
  estoqueFisicoTotal: number;
  estoqueDistribuidoTotal: number;
  estoqueDisponivelParaAlocar: number;
  estoquePorCanal: { [key: string]: number };
  fotoPrincipalUrl: string;
  materiaPrima?: MaterialType;
  dimensoes: DimensionsUnitarias;
}

export interface EmbeddedProducts {
  produtos: Product[];
}

export interface ApiResponseProducts extends Hateoas {
  _embedded: EmbeddedProducts;
  page?: PageInfo;
}

export interface PageInfo {
  size: number;
  totalElements: number;
  totalPages: number;
  number: number;
}
