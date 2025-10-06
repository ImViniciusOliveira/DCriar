import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Product } from '../../models/products.model';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ProductsService } from '../../services/products';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../../../shared/components/confirm-dialog/confirm-dialog/confirm-dialog';
import { forkJoin, map, filter, catchError, of, switchMap, EMPTY, tap, finalize } from 'rxjs';
import { ProductFormComponent, ProductFormData } from '../product-form/product-form';
import { StockService } from '../../../stock/services/stock.service';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatDialogModule,
    MatCardModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './product-list.html',
  styleUrls: ['./product-list.scss'],
})
export class ProductList implements OnInit {
  private readonly productsService = inject(ProductsService);
  private readonly stockService = inject(StockService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  products = signal<Product[]>([]);
  isLoading = signal(false);
  displayedColumns: string[] = ['sku', 'nome', 'cor', 'estoque', 'estoquePorCanal', 'acoes'];

  // Paginação
  totalElements = signal(0);
  pageSize = signal(10);
  pageIndex = signal(0);

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  private readonly channelNameMap = new Map<string, string>([
    ['LOJA_FISICA', 'Loja Física'],
    ['SHOPEE', 'Shopee'],
    ['SITE_PROPRIO', 'Site Próprio'],
    ['MERCADO_LIVRE', 'Mercado Livre']
  ]);

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.isLoading.set(true);
    forkJoin({
      productsResponse: this.productsService.getProducts(
        this.pageIndex(),
        this.pageSize()
      ),
      channelStockMap: this.stockService.getChannelStockMap().pipe(
        catchError(error => {
          console.error('Erro ao buscar estoque por canal. A tabela será exibida sem esses dados.', error);
          return of(new Map<number, { [key: string]: number }>()); // Retorna um mapa vazio em caso de erro
        })
      )
    }).pipe(
      tap(({ productsResponse }) => {
        // Ajuste aqui para usar a propriedade correta do ApiResponseProducts
        this.totalElements.set(productsResponse.page?.totalElements || 0);
      }),
      map(({ productsResponse, channelStockMap }) => {
        const products = productsResponse._embedded?.produtos || [];
        // Adiciona as informações de estoque por canal a cada produto
        return products.map(product => ({
          ...product,
          estoquePorCanal: channelStockMap.get(product.id) || {}
        }));
      }),
      finalize(() => this.isLoading.set(false))
    ).subscribe(mergedProducts => {
      this.products.set(mergedProducts);
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadProducts();
  }

  onDelete(product: Product): void {
    const dialogData: ConfirmDialogData = {
      title: 'Confirmar Exclusão',
      message: `Tem certeza que deseja excluir o produto "${product.nome}"?`,
    };

    const dialogRef = this.dialog.open(ConfirmDialog, { data: dialogData });

    dialogRef
      .afterClosed()
      .pipe(filter(result => result === true))
      .pipe(
        switchMap(() => {
        const deleteUrl = product._links['deletar-produto']?.href;
          return deleteUrl ? this.productsService.deleteProduct(deleteUrl) : EMPTY;
        })
      )
      .subscribe(() => {
        // A exclusão e o `refresh$` no serviço foram concluídos.
        // Agora, recarregamos os dados combinados na lista.
        this.loadProducts();
        this.snackBar.open('Produto excluído com sucesso!', 'Fechar', {
          duration: 3000,
        });
      });
  }

  onView(product: Product): void {
    const dialogData: ProductFormData = { product, isEditMode: false };
    this.dialog.open(ProductFormComponent, {
      data: dialogData,
      width: '800px',
    });
  }

  onEdit(product: Product): void {
    // Cria uma cópia profunda do produto para evitar mutação direta do objeto original.
    // Isso previne o erro ExpressionChangedAfterItHasBeenCheckedError.
    const productCopy = JSON.parse(JSON.stringify(product));
    const dialogData: ProductFormData = { product: productCopy, isEditMode: true };
    const dialogRef = this.dialog.open(ProductFormComponent, {
      data: dialogData,
      width: '800px',
    });

    dialogRef.afterClosed().pipe(filter(result => result === true)).subscribe(() => {
      this.snackBar.open('Produto salvo com sucesso!', 'Fechar', {
        duration: 3000,
      });
      this.loadProducts();
    });
  }

  onCreate(): void {
    const newProduct: Partial<Product> = {
      nome: '',
      sku: '',
      descricao: '',
      cor: '',
      unidadesPorProduto: 1,
      ativo: true,
      dimensoesUnitarias: { larguraCm: 0, comprimentoCm: 0 },
    };

    const dialogData: ProductFormData = { product: newProduct as Product, isEditMode: false, isCreationMode: true };
    const dialogRef = this.dialog.open(ProductFormComponent, {
      data: dialogData,
      width: '800px',
    });

    dialogRef.afterClosed().pipe(filter(result => result === true)).subscribe(() => {
      this.snackBar.open('Produto cadastrado com sucesso!', 'Fechar', { duration: 3000 });
      this.loadProducts();
    });
  }

  getChannelDisplayName(channelKey: string): string {
    return this.channelNameMap.get(channelKey) || channelKey;
  }
}
