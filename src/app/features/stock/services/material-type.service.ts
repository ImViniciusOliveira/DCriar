import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { PagedMaterialTypesResponse } from '../models/material-type.model';

@Injectable({
  providedIn: 'root',
})
export class MaterialTypeService {
  private readonly http = inject(HttpClient);

  searchMaterialTypes(
    searchUrl: string,
    filters: { nome?: string; unidadeDeConsumo?: string },
    page = 0,
    size = 20
  ): Observable<PagedMaterialTypesResponse> {
    if (!searchUrl) {
      return throwError(() => new Error('URL de busca de matérias-primas não fornecida.'));
    }

    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', 'nome,ASC');

    if (filters.nome) {
      params = params.set('nome', filters.nome);
    }
    if (filters.unidadeDeConsumo) {
      params = params.set('unidadeDeConsumo', filters.unidadeDeConsumo);
    }

    return this.http.get<PagedMaterialTypesResponse>(searchUrl, { params });
  }
}
