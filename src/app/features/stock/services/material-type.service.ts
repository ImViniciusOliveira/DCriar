import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, filter, map, shareReplay, switchMap } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { ApiRoot } from '../../../core/services/api-root';
import { ApiResponseMaterialTypes, MaterialType } from '../models/material-type.model';

@Injectable({
  providedIn: 'root',
})
export class MaterialTypeService {
  private readonly http = inject(HttpClient);
  private readonly apiRoot = inject(ApiRoot);

  private readonly materialTypesUrl$ = toObservable(this.apiRoot.endpoints).pipe(
    filter((endpoints): endpoints is NonNullable<typeof endpoints> => !!endpoints),
    map(endpoints => {
      const url = endpoints?._links['tiposMateriaPrima']?.href;
      if (!url) {
        throw new Error('URL de tipos-materia-prima não encontrada na resposta da API');
      }
      // Remove a parte do template {&...} para obter a URL base
      return this.toRelativeUrl(url.split('{')[0]);
    }),
    shareReplay(1)
  );

  searchMaterialTypes(filters: { nome?: string; unidadeDeConsumo?: string }): Observable<MaterialType[]> {
    return this.materialTypesUrl$.pipe(
      switchMap(url => {
        let params = new HttpParams().set('sort', 'nome,ASC').set('size', '20'); // Limita a 20 resultados
        if (filters.nome) {
          params = params.set('nome', filters.nome);
        }
        if (filters.unidadeDeConsumo) {
          params = params.set('unidadeDeConsumo', filters.unidadeDeConsumo);
        }
        return this.http.get<ApiResponseMaterialTypes>(url, { params });
      }),
      map(response => response._embedded?.['tipos-materia-prima'] || [])
    );
  }

  private toRelativeUrl(absoluteUrl: string): string {
    const url = new URL(absoluteUrl);
    return url.pathname + url.search + url.hash;
  }
}
