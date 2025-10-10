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
import { filter, catchError, of, lastValueFrom } from 'rxjs';
import { ProductFormComponent, ProductFormData } from '../product-form/product-form';
import { StockService } from '../../../stock/services/stock.service';
import { MatCardModule } from '@angular/material/card';

// Constante a nível de módulo para mapear chaves de canal para nomes de exibição.
const CHANNEL_NAME_MAP = new Map<string, string>([
  ['LOJA_FISICA', 'Loja Física'],
  ['SHOPEE', 'Shopee'],
  ['SITE_PROPRIO', 'Site Próprio'],
  ['MERCADO_LIVRE', 'Mercado Livre']
]);

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
  // Centraliza os textos para facilitar a manutenção e futuras traduções.
  private static readonly Texts = {
    deleteConfirmTitle: 'Confirmar Exclusão',
    deleteConfirmMessage: (name: string) => `Tem certeza que deseja excluir o produto "${name}"?`,
    deleteSuccess: 'Produto excluído com sucesso!',
    saveSuccess: 'Produto salvo com sucesso!',
    createSuccess: 'Produto cadastrado com sucesso!',
    deleteError: 'Falha ao excluir o produto.',
  };
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

  ngOnInit(): void {
    this.loadProducts();
  }

  async loadProducts(): Promise<void> {
    this.isLoading.set(true);
    try {
      const [productsResponse, channelStockMap] = await Promise.all([
        lastValueFrom(this.productsService.getProducts(this.pageIndex(), this.pageSize())),
        lastValueFrom(this.stockService.getChannelStockMap().pipe(
          catchError(error => {
            console.error('Erro ao buscar estoque por canal. A tabela será exibida sem esses dados.', error);
            return of(new Map<number, { [key: string]: number }>()); // Retorna um mapa vazio em caso de erro
          })
        ))
      ]);

      this.totalElements.set(productsResponse.page?.totalElements || 0);

      const products = productsResponse._embedded?.produtos || [];
      const mergedProducts = products.map(product => ({
        ...product,
        estoquePorCanal: channelStockMap.get(product.id) || {}
      }));

      this.products.set(mergedProducts);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      this.snackBar.open('Falha ao carregar produtos.', 'Fechar', { duration: 3000 });
    } finally {
      this.isLoading.set(false);
    }
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadProducts();
  }

  async onDelete(product: Product): Promise<void> {
    const dialogData: ConfirmDialogData = {
      title: ProductList.Texts.deleteConfirmTitle,
      message: ProductList.Texts.deleteConfirmMessage(product.nome),
    };

    const dialogRef = this.dialog.open(ConfirmDialog, { data: dialogData });
    const confirmed = await lastValueFrom(dialogRef.afterClosed());

    if (confirmed) {
      try {
        const deleteUrl = product._links['deletar-produto']?.href;
        if (!deleteUrl) {
          throw new Error('URL de exclusão não encontrada.');
        }
        await lastValueFrom(this.productsService.deleteProduct(deleteUrl));
        this.snackBar.open(ProductList.Texts.deleteSuccess, 'Fechar', { duration: 3000 });
        await this.loadProducts(); // Recarrega a lista
      } catch (error) {
        console.error('Erro ao excluir produto:', error);
        this.snackBar.open(ProductList.Texts.deleteError, 'Fechar', { duration: 3000 });
      }
    }
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
      this.snackBar.open(ProductList.Texts.saveSuccess, 'Fechar', {
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
      this.snackBar.open(ProductList.Texts.createSuccess, 'Fechar', { duration: 3000 });
      this.loadProducts();
    });
  }

  getChannelDisplayName(channelKey: string): string {
    return CHANNEL_NAME_MAP.get(channelKey) || channelKey;
  }
}
