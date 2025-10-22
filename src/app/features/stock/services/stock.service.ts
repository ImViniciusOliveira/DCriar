import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, switchMap, take, catchError, of } from 'rxjs';
import { Channel, ProductChannelStock } from '../models/channel-stock.model';
import { ApiRoot } from '../../../core/services/api-root';
import { environment } from '../../../core/services/environment';

@Injectable({
  providedIn: 'root'
})
export class StockService {
  private readonly http = inject(HttpClient);
  private readonly apiRoot = inject(ApiRoot);

  private getChannelStockUrl(): string {
    const apiRootData = this.apiRoot.endpoints();

    // Tenta descobrir a URL via HATEOAS, com fallbacks.
    const estoqueHref = apiRootData?._links?.['estoque-por-canal']?.href
      || apiRootData?._links?.['estoques']?.href
      || `${environment.apiUrl}/api/v1/estoques/por-produto-canais`; // fallback estático

    // Garante que a URL esteja limpa, sem templates.
    return estoqueHref.split('{')[0];
  }

  getChannelStockMap(): Observable<Map<number, { [key: string]: number }>> {
    // Espera a API raiz carregar, depois obtém a URL e faz a chamada.
    return this.apiRoot.endpoints$.pipe(
      take(1), // Garante que só executamos uma vez.
      switchMap(() => {
        const url = this.getChannelStockUrl();
        return this.http.get<ProductChannelStock[]>(url).pipe(
          map(response => {
            const productStocks = Array.isArray(response) ? response : [];
            return productStocks.reduce((stockMap, productStock) => {
              if (productStock?.canais) stockMap.set(productStock.produtoId, this.createChannelMap(productStock.canais));
              return stockMap;
            }, new Map<number, { [key: string]: number }>());
          }),
          catchError(err => {
            console.error('Falha ao buscar mapa de estoque por canal.', err);
            return of(new Map<number, { [key: string]: number }>());
          })
        );
      })
    );
  }

  private createChannelMap(channels: Channel[]): { [key: string]: number } {
    return channels.reduce((acc, channel) => {
      acc[channel.canalNome] = channel.quantidade;
      return acc;
    }, {} as { [key: string]: number });
  }
}
