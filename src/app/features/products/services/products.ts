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

  getProducts(page: number = 0, size: number = 10): Observable<ApiResponseProducts> {
    return this.endpoints$.pipe(
      map((endpoints) => this.getProductUrl(endpoints)),
      switchMap((url) =>
        this.fetchProducts(url, page, size).pipe(
          map(response => this.transformProductResponse(response, size)),
          catchError(err => {
            console.error(`Falha ao buscar produtos na página ${page}, tamanho ${size}`, err);
            return of({ _embedded: { produtos: [] }, _links: {}, page: { size: 0, totalElements: 0, totalPages: 0, number: 0 } } as ApiResponseProducts);
          })
        )
      ),
      take(1)
    );
  }

  getNewProductTemplate(): Observable<Product> {
    return this.endpoints$.pipe(
      map(endpoints => {
        const url = endpoints?._links?.['novo-produto']?.href;
        if (!url) throw new Error('URL para template de novo produto não encontrada na API.');
        return url;
      }),
      switchMap(baseUrl => this.http.get<Product>(`${baseUrl}/new`)),
      take(1)
    );
  }

  getProductById(id: number): Observable<Product> {
    return this.endpoints$.pipe(
      map(endpoints => this.getProductUrl(endpoints)),
      switchMap(baseUrl => this.http.get<Product>(`${baseUrl}/${id}`)),
      take(1)
    );
  }

  private fetchProducts(url: string, page: number, size: number): Observable<ApiResponseProducts> {
    const fullUrl = url.replace('{?page,size,sort}', `?page=${page}&size=${size}&sort=nome,ASC`);
    return this.http.get<ApiResponseProducts>(fullUrl); // TODO: Implementar ordenação dinâmica
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
      map(endpoints => this.getProductUrl(endpoints)),
      switchMap(url => this.http.post<Product>(url, product)),
      tap(() => this.refresh$.next()) // O tap aqui retorna o que o switchMap emitiu, que é o Produto.
    );
  }

  patchProduct(productId: number, product: Partial<Product>): Observable<Product> {
    if (!product.id) {
      delete product.id;
    }
    return this.endpoints$.pipe(
      map(endpoints => this.getProductUrl(endpoints)),
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
    const url = endpoints?._links?.['produtos']?.href;
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
