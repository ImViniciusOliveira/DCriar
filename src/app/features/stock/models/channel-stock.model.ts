export interface Channel {
  canalId: number;
  canalNome: string;
  quantidade: number;
}

export interface ProductChannelStock {
  produtoId: number;
  produtoNome: string;
  canais: Channel[];
}
