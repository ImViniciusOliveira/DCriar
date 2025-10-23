import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class StockService {
  // O serviço de estoque foi simplificado. A lógica de busca de estoque por canal
  // foi movida para o ProductsService para alinhar com a resposta HATEOAS por produto.
  // Este serviço pode ser usado para futuras funcionalidades globais de estoque.
}
