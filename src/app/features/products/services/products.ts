import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, filter, map, switchMap, tap, shareReplay, take, catchError, of } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';

import { ApiRoot } from '../../../core/services/api-root';
import { Hateoas } from '../../../core/models/hateoas.model';
import { ApiResponseProducts , Product } from '../models/products.model';

@Injectable({
  providedIn: 'root',
})
export class ProductsService {
  private readonly http = inject(HttpClient);
  private readonly apiRoot = inject(ApiRoot);

  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  private readonly endpoints$ = toObservable(this.apiRoot.endpoints).pipe(
    filter((endpoints): endpoints is NonNullable<typeof endpoints> => !!endpoints),
    shareReplay(1)
  );

  getProducts(page: number = 0, size: number = 10, sort: string = 'nome,ASC'): Observable<ApiResponseProducts> {
    return this.endpoints$.pipe(
      take(1), // Pega o valor atual dos endpoints e completa.
      map(endpoints => {
        const baseUrl = this.getProductUrl(endpoints);
        console.log('[ProductsService] getProducts: URL base (templada) obtida:', baseUrl);
        const finalUrl = baseUrl.replace('{?page,size,sort}', `?page=${page}&size=${size}&sort=${sort}`);
        console.log('[ProductsService] getProducts: URL final construída:', finalUrl);
        return finalUrl;
      }),
      switchMap(url => this.http.get<ApiResponseProducts>(url)),
      map(response => this.transformProductResponse(response, size)),
      catchError(err => {
        console.error(`Falha ao buscar produtos na página ${page}, tamanho ${size}`, err);
        return of({ _embedded: { produtos: [] }, _links: {}, page: { size: 0, totalElements: 0, totalPages: 0, number: 0 } } as ApiResponseProducts);
      })
    );
  }

  getNewProductTemplate(): Observable<Product> {
    return this.endpoints$.pipe(
      // O template de um novo produto é um sub-recurso da coleção de produtos.
      map(endpoints => this.getProductUrl(endpoints).split('{')[0]),
      switchMap(baseUrl => this.http.get<Product>(`${baseUrl}/new`)),
      take(1)
    );
  }

  getProductById(id: number): Observable<Product> {
    return this.endpoints$.pipe(
      map(endpoints => this.getProductUrl(endpoints).split('{')[0]),
      switchMap(baseUrl => this.http.get<Product>(`${baseUrl}/${id}`)),
      take(1)
    );
  }

  deleteProduct(url: string): Observable<void> {
    return this.http.delete<void>(url).pipe(
      tap(() => this.refresh$.next()) // Dispara o recarregamento da lista de produtos.
    );
  }

  updateProduct(url: string, product: Product): Observable<Product> {
    return this.http.put<Product>(url, product);
  }

  createProduct(product: Partial<Product>): Observable<Product> {
    return this.endpoints$.pipe(
      take(1),
      map(endpoints => {
        return this.getProductUrl(endpoints).split('{')[0]; // Remove o template da URL
      }),
      switchMap(url => this.http.post<Product>(url, product)),
      tap(() => this.refresh$.next()) // O tap aqui retorna o que o switchMap emitiu, que é o Produto.
    );
  }

  patchProduct(productId: number, product: Partial<Product>): Observable<Product> {
    if (!product.id) {
      delete product.id;
    }
    return this.endpoints$.pipe(
      map(endpoints => this.getProductUrl(endpoints).split('{')[0]),
      switchMap(baseUrl => this.http.patch<Product>(`${baseUrl}/${productId}`, product)),
      tap(() => this.refresh$.next())
    );
  }

  uploadProductPhoto(uploadUrl: string, file: File): Observable<Product> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<Product>(uploadUrl, formData)
      .pipe(tap(() => this.refresh$.next()));
  }

  private getProductUrl(endpoints: Hateoas): string {
    // Prioriza o link paginado, mas usa o link simples como fallback.
    const url = endpoints?._links?.['produtos-paged']?.href || endpoints?._links?.['produtos']?.href;
    if (!url) {
      throw new Error('URL de produtos não encontrada na resposta da API');
    }
    return url;
  }

  private transformProductResponse(response: any, size: number): ApiResponseProducts {
    return {
      ...response,
      _links: response._links || {},
      page: {
        ...response.page,
      },
    };
  }
}
