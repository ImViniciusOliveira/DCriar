import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, switchMap, take } from 'rxjs';
import { ProductChannelStock } from '../models/channel-stock.model';
import { toObservable } from '@angular/core/rxjs-interop';
import { ApiRoot } from '../../../core/services/api-root';

@Injectable({
  providedIn: 'root'
})
export class StockService {
  private readonly http = inject(HttpClient);
  private readonly apiRoot = inject(ApiRoot);

  // URL agora é descoberta via HATEOAS para consistência
  private readonly channelStockUrl$ = toObservable(this.apiRoot.endpoints).pipe(
    map(endpoints => endpoints?._links?.['estoque-por-canal']?.href || '/api/v1/estoques/por-produto-canais')
  );

  /**
   * Busca o estoque de todos os produtos por canal e retorna um `Map`
   * para fácil acesso, onde a chave é o ID do produto.
   */
  getChannelStockMap(): Observable<Map<number, { [key: string]: number }>> {
    return this.channelStockUrl$.pipe(
      take(1), // Garante que o observable complete após a primeira emissão da URL.
      switchMap(url => this.http.get<ProductChannelStock[]>(url)),
      map(response =>
        response.reduce((stockMap, productStock) => {
          const channels = productStock.canais.reduce((acc, channel) => {
            acc[channel.canalNome] = channel.quantidade;
            return acc;
          }, {} as { [key: string]: number });
          stockMap.set(productStock.produtoId, channels);
          return stockMap;
        }, new Map<number, { [key: string]: number }>())
      )
    );
  }
}
