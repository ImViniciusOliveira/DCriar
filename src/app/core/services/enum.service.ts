import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, map } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';
import { ApiRoot } from './api-root';

export interface EnumOption {
  value: string;
  viewValue: string;
  simbolo?: string; // Adicionando o símbolo
}

// Interface para descrever um item individual na resposta da API de enums.
interface EnumResponseItem {
  name: string;
  descricao: string;
  simbolo: string;
  [key: string]: any; // Permite outras propriedades como 'simbolo' e '_links'.
}

// Interface genérica para a estrutura de resposta HATEOAS com _embedded.
interface EmbeddedEnumResponse {
  _embedded: { [key: string]: EnumResponseItem[] };
}

@Injectable({
  providedIn: 'root'
})
export class EnumService {
  private readonly http = inject(HttpClient);
  private readonly apiRoot = inject(ApiRoot);
  private cache: { [key: string]: Observable<any> } = {};

  /**
   * Retorna um Observable com um mapa de unidades de consumo.
   * O mapa é cacheado por URL para evitar requisições repetidas.
   * @param url A URL HATEOAS para o recurso 'unidades-de-medida'.
   */
  getConsumptionUnitsMap(url: string): Observable<Map<string, EnumOption>> {
    // A URL é a chave do cache para o mapa, garantindo que cada URL única
    // tenha seu próprio fluxo de mapa cacheado.
    const cacheKey = `map_${url}`;
    if (!this.cache[cacheKey]) {
      this.cache[cacheKey] = this.getEnumOptions(url).pipe( // Cria o mapa a partir das opções
        map(options => new Map(options.map(opt => [opt.value, opt]))),
        shareReplay(1)
      );
    }
    return this.cache[cacheKey];
  }

  getEnumOptions(url: string): Observable<EnumOption[]> {
    if (!this.cache[url]) {
      this.cache[url] = this.http.get<EmbeddedEnumResponse>(url).pipe(
        map(response => {
          // Extrai o primeiro array encontrado dentro do objeto _embedded
          const embedded = response?._embedded;

          const key = Object.keys(embedded)[0];
          const items = embedded[key] || [];

          // Mapeia os campos 'name' e 'descricao' para 'value' e 'viewValue' com segurança de tipo.
          const mappedItems = items.map(item => ({
            value: item.name,
            viewValue: item.descricao,
            simbolo: item.simbolo
          }));
          return mappedItems;
        }),
        shareReplay(1),
        catchError(err => {
          console.error(`Falha ao buscar enum da URL: ${url}`, err);
          return of([]);
        })
      );
    }
    return this.cache[url];
  }
}
