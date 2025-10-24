import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, filter, map, shareReplay, switchMap, take } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { ApiRoot } from '../../../core/services/api-root';
import { Hateoas } from '../../../core/models/hateoas.model';

// Modelo para um único Canal de Venda
export interface SalesChannel {
  id: number;
  nome: string;
  ativo: boolean;
  _links?: any;
}

// Modelo para a resposta da coleção do backend
interface ApiResponseSalesChannels extends Hateoas {
  _embedded: {
    'canais-venda': SalesChannel[];
  };
}

@Injectable({
  providedIn: 'root',
})
export class SalesChannelService {
  private readonly http = inject(HttpClient);
  private readonly apiRoot = inject(ApiRoot);

  // A single, cached stream of all sales channels from the API.
  private readonly allChannels$: Observable<SalesChannel[]> = this.fetchAllSalesChannels().pipe(
    shareReplay(1)
  );

  // Expõe um mapa reativo de Identificador -> Nome (Ex: 'LOJA_FISICA' -> 'Loja Física')
  readonly channelNameMap$: Observable<Map<string, string>> = this.allChannels$.pipe(
    map(channels => new Map(channels.map(c => [c.nome, c.nome])))
  );

  // Expõe uma lista reativa de todos os identificadores de canal (Ex: ['LOJA_FISICA', 'SHOPEE', ...])
  readonly channelKeys$: Observable<string[]> = this.allChannels$.pipe(
    map(channels => channels.map(c => c.nome))
  );

  private fetchAllSalesChannels(): Observable<SalesChannel[]> {
    return toObservable(this.apiRoot.endpoints).pipe(
      filter((endpoints): endpoints is NonNullable<typeof endpoints> => !!endpoints),
      take(1),
      map(endpoints => {
        const url = endpoints._links?.['canais-venda']?.href;
        if (!url) {
          throw new Error('URL de canais-venda não encontrada na resposta da API');
        }
        return url;
      }),
      switchMap(url => this.http.get<ApiResponseSalesChannels>(url)),
      map(response => response._embedded?.['canais-venda'] || [])
    );
  }
}
