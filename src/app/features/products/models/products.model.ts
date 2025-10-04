import { Hateoas, Link } from '../../../core/models/hateoas.model';

export interface Dimensions {
  largura: number;
  comprimento: number;
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
  dimensoes: Dimensions;
}

export interface EmbeddedProducts {
  produtos: Product[];
}

export interface ApiResponseProducts extends Hateoas {
  _embedded: EmbeddedProducts;
}
