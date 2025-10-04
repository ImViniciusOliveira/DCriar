import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, filter, shareReplay, switchMap, take } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';

import { ApiRoot } from '../../../core/services/api-root';
import { ApiResponseProducts } from '../models/products.model';
import { Product } from '../models/products.model';

@Injectable({
  providedIn: 'root',
})
export class ProductsService {
  private http = inject(HttpClient);
  private apiRoot = inject(ApiRoot);

  private products$: Observable<ApiResponseProducts>;

  constructor() {
    this.products$ = toObservable(this.apiRoot.endpoints).pipe(
      filter((endpoints): endpoints is NonNullable<typeof endpoints> => !!endpoints),
      take(1),
      switchMap(endpoints => {
        const productsUrl = endpoints._links['produtos']?.href;
        if (!productsUrl) {
          throw new Error('URL de produtos não encontrada na resposta da API');
        }
        const relativeUrl = this.toRelativeUrl(productsUrl);
        return this.http.get<ApiResponseProducts>(relativeUrl);
      }),
      shareReplay(1) // Cache the result and replay for subsequent subscribers
    );
  }

  getProducts(): Observable<ApiResponseProducts> {
    return this.products$;
  }

  deleteProduct(url: string): Observable<void> {
    const relativeUrl = this.toRelativeUrl(url);
    return this.http.delete<void>(relativeUrl);
  }

  updateProduct(url: string, product: Product): Observable<Product> {
    const relativeUrl = this.toRelativeUrl(url);
    return this.http.put<Product>(relativeUrl, product);
  }

  private toRelativeUrl(absoluteUrl: string): string {
    try {
      const url = new URL(absoluteUrl);
      return url.pathname + url.search + url.hash;
    } catch (e) {
      // If it's already a relative URL or invalid, return as is.
      return absoluteUrl;
    }
  }
}
