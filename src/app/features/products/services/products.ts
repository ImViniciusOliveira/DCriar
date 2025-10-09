import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, filter, map, switchMap, tap, shareReplay, combineLatest, take } from 'rxjs';
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

  // Usamos um BehaviorSubject para controlar o recarregamento dos dados.
  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  private readonly endpoints$ = toObservable(this.apiRoot.endpoints).pipe(
    filter((endpoints): endpoints is NonNullable<typeof endpoints> => !!endpoints),
    shareReplay(1)
  );

  private readonly products$: Observable<ApiResponseProducts>;

  constructor() {
    // A lógica de busca agora fica no construtor, que é um contexto de injeção.
    this.products$ = combineLatest([this.refresh$, this.endpoints$]).pipe(
      map(([, endpoints]) => this.getProductUrl(endpoints)),
      switchMap((url) => this.fetchProducts(url, 0, 10)),
      shareReplay({
        bufferSize: 1, // Armazena o último valor em cache.
        refCount: true, // O cache é limpo quando não há mais assinantes.
      })
    );
  }

  getProducts(page: number = 0, size: number = 10): Observable<ApiResponseProducts> {
    // A new fetch is triggered for each call, respecting pagination
    return this.endpoints$.pipe(
      map((endpoints) => this.getProductUrl(endpoints)),
      switchMap((url) => this.fetchProducts(url, page, size)),
      take(1)
    );
  }

  private fetchProducts(url: string, page: number, size: number): Observable<ApiResponseProducts> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', 'nome,ASC');
    return this.http.get<ApiResponseProducts>(url, { params });
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
    const endpoints = this.apiRoot.endpoints(); // Obtém o valor atual do sinal
    if (!endpoints) {
      throw new Error('Os endpoints não foram carregados. Certifique-se de que o método loadEndpoints foi chamado.');
    }
    const url = endpoints._links['produtos']?.href;
    if (!url) {
      throw new Error('URL de produtos não encontrada na resposta da API');
    }
    return this.http.post<Product>(url, product).pipe(
      tap(() => this.refresh$.next()) // Dispara o recarregamento da lista de produtos.
    );
  }

  patchProduct(url: string, product: Partial<Product>): Observable<Product> {
    return this.http.patch<Product>(url, product).pipe(
      tap(() => this.refresh$.next()) // Dispara o recarregamento da lista de produtos.
    );
  }

  /**
   * Etapa 1: Envia uma imagem para o endpoint de upload genérico.
   * @returns Um observable com a URL do arquivo enviado.
   */
  uploadImage(file: File): Observable<{ fileDownloadUri: string }> {
    const formData = new FormData();
    formData.append('file', file);
    // Utiliza a URL de upload do HATEOAS, se disponível, ou um fallback.
    return this.endpoints$.pipe(
      switchMap(endpoints => {
        const uploadUrl = endpoints._links['upload']?.href || '/api/v1/uploads';
        return this.http.post<{ fileDownloadUri: string }>(uploadUrl, formData);
      })
    );
  }

  /**
   * Etapa 2: Atualiza a URL da foto do produto.
   */
  updateProductPhotoUrl(productUpdateUrl: string, product: Product, imageUrl: string): Observable<Product> {
    // Envia apenas os campos necessários para a atualização, evitando o envio de objetos complexos.
    const payload = {
      ...product, // Envia o objeto completo do produto
      fotoPrincipalUrl: imageUrl, // Sobrescreve a URL da imagem
      tipoMateriaPrimaId: product.tipoMateriaPrima?.id, // Garante que o ID da matéria-prima seja enviado
    };
    return this.patchProduct(productUpdateUrl, payload);
  }

  private getProductUrl(endpoints: Hateoas): string {
    const url = endpoints?._links['produtos']?.href;
    if (!url) {
      throw new Error('URL de produtos não encontrada na resposta da API');
    }
    // Retorna a URL base, removendo os templates HATEOAS
    return url.split('{')[0];
  }
}
