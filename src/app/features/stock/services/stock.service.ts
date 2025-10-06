import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ProductChannelStock } from '../models/channel-stock.model';

@Injectable({
  providedIn: 'root'
})
export class StockService {
  private readonly http = inject(HttpClient);
  private readonly channelStockUrl = '/api/v1/estoques/por-produto-canais';

  /**
   * Busca o estoque de todos os produtos por canal e retorna um `Map`
   * para fácil acesso, onde a chave é o ID do produto.
   */
  getChannelStockMap(): Observable<Map<number, { [key: string]: number }>> {
    return this.http.get<ProductChannelStock[]>(this.channelStockUrl).pipe(
      map(response => {
        const stockMap = new Map<number, { [key: string]: number }>();
        for (const productStock of response) {
          const channels = productStock.canais.reduce((acc, channel) => {
            acc[channel.canalNome] = channel.quantidade;
            return acc;
          }, {} as { [key: string]: number });
          stockMap.set(productStock.produtoId, channels);
        }
        return stockMap;
      })
    );
  }
}
