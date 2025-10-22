import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, switchMap, take, catchError, of, shareReplay, filter } from 'rxjs';
import { ApiResponseProducts } from '../../products/models/products.model';
import { Channel, ProductChannelStock } from '../models/channel-stock.model';
import { toObservable } from '@angular/core/rxjs-interop';
import { ApiRoot } from '../../../core/services/api-root';

@Injectable({
  providedIn: 'root'
})
export class StockService {
  private readonly http = inject(HttpClient);
  private readonly apiRoot = inject(ApiRoot);

  // 1. Primeiro, descobrimos a URL para a lista de produtos a partir do ApiRoot.
  private readonly productsUrl$ = toObservable(this.apiRoot.endpoints).pipe(
    filter(endpoints => !!endpoints?._links), // Garante que só prosseguimos quando os links da API estiverem carregados.
    map(endpoints => {
      const url = endpoints?._links?.['produtos']?.href;
      if (!url) throw new Error('URL para produtos não encontrada na API Root.');
      // Usamos size=1 para pegar apenas o necessário para descobrir o link, otimizando a chamada.
      return url.replace('{?page,size,sort}', '?page=0&size=1');
    }),
    shareReplay(1) // Cacheia a URL dos produtos para não buscar na raiz toda vez.
  );

  // 2. Em seguida, usamos a URL dos produtos para encontrar a URL do "estoque-por-canal".
  private readonly channelStockUrl$ = this.productsUrl$.pipe(
    switchMap(productsUrl => this.http.get<ApiResponseProducts>(productsUrl)),
    map(productsResponse => {
      const url = productsResponse?._links?.['estoque-por-canal']?.href;
      if (!url) {
        // Este erro agora é mais preciso, indicando que o link não veio na resposta de /produtos.
        throw new Error('URL para estoque por canal não encontrada na resposta de /produtos.');
      }
      return url;
    }),
    shareReplay(1) // Cacheia a URL do estoque para não fazer essa busca complexa toda vez.
  );

  getChannelStockMap(): Observable<Map<number, { [key: string]: number }>> {
    return this.channelStockUrl$.pipe(
      take(1),
      switchMap(url =>
        this.http.get<ProductChannelStock[]>(url).pipe(
          map(response =>
            (Array.isArray(response) ? response : []).reduce((stockMap, productStock) => {
              if (productStock?.canais) stockMap.set(productStock.produtoId, this.createChannelMap(productStock.canais));
              return stockMap;
            }, new Map<number, { [key: string]: number }>())
          ),
          catchError(err => {
            console.error('Falha ao buscar mapa de estoque por canal.', err);
            return of(new Map<number, { [key: string]: number }>());
          })
        )
      )
    );
  }

  private createChannelMap(channels: Channel[]): { [key: string]: number } {
    return channels.reduce((acc, channel) => {
      acc[channel.canalNome] = channel.quantidade;
      return acc;
    }, {} as { [key: string]: number });
  }
}
