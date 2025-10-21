import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, switchMap, take, catchError, of } from 'rxjs';
import { Channel, ProductChannelStock } from '../models/channel-stock.model';
import { toObservable } from '@angular/core/rxjs-interop';
import { ApiRoot } from '../../../core/services/api-root';

@Injectable({
  providedIn: 'root'
})
export class StockService {
  private readonly http = inject(HttpClient);
  private readonly apiRoot = inject(ApiRoot);

  private readonly channelStockUrl$ = toObservable(this.apiRoot.endpoints).pipe(
    map(endpoints => endpoints?._links?.['estoque-por-canal']?.href || '/api/v1/estoques/por-produto-canais')
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
            console.error('Falha ao buscar mapa de estoque por canal.', err); // TODO: Adicionar tratamento de erro global
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
