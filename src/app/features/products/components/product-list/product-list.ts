import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Product } from '../../models/products.model';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { Sort, MatSortModule } from '@angular/material/sort';
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
    MatSortModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './product-list.html',
  styleUrls: ['./product-list.scss'],
})
export class ProductList implements OnInit {
  private static readonly Texts = {
    deleteConfirmTitle: 'Confirmar Exclusão',
    deleteConfirmMessage: (name: string) => `Tem certeza que deseja excluir o produto "${name}"?`,
    deleteSuccess: 'Produto excluído com sucesso!',
    saveSuccess: 'Produto salvo com sucesso!',
    createSuccess: 'Produto cadastrado com sucesso!',
    deleteError: 'Falha ao excluir o produto.',
    loadError: 'Falha ao carregar a lista de produtos. Tente novamente mais tarde.',
  };
  private readonly productsService = inject(ProductsService);
  private readonly stockService = inject(StockService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  products = signal<Product[]>([]);
  isLoading = signal(false);
  displayedColumns: string[] = ['sku', 'nome', 'cor', 'dimensoes', 'ativo', 'estoque', 'estoquePorCanal', 'acoes'];

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
            console.error('Erro ao buscar estoque por canal. A tabela será exibida sem esses dados.', error); // TODO: Adicionar notificação ao usuário
            return of(new Map<number, { [key: string]: number }>());
          })
        ))
      ]);

      this.totalElements.set(productsResponse.page?.totalElements || 0);

      const products = productsResponse?._embedded?.produtos || [];

      const baseChannelStock = Object.fromEntries(Array.from(CHANNEL_NAME_MAP.keys()).map(key => [key, 0]));

      const mergedProducts = products.map(product => {
        const productChannelStock = channelStockMap.get(product.id) || {};
        product.estoquePorCanal = { ...baseChannelStock, ...productChannelStock };
        return product;
      });

      this.products.set(mergedProducts);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      this.snackBar.open(ProductList.Texts.loadError, 'Fechar', { duration: 5000 });
    } finally {
      this.isLoading.set(false);
    }
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadProducts();
  }

  sortData(sort: Sort) {
    if (!sort.active || sort.direction === '') {
      this.loadProducts();
      return;
    }

    const sortedData = [...this.products()].sort((a, b) => {
      const isAsc = sort.direction === 'asc';
      switch (sort.active) {
        case 'sku':
          return compare(a.sku, b.sku, isAsc);
        case 'nome':
          return compare(a.nome, b.nome, isAsc);
        case 'cor':
          return compare(a.cor, b.cor, isAsc);
        case 'estoque':
          return compare(a.estoqueFisicoTotal, b.estoqueFisicoTotal, isAsc);
        case 'dimensoes':
          {
            const aLargura = a.dimensoes?.larguraCm ?? 0;
            const bLargura = b.dimensoes?.larguraCm ?? 0;
            const aComprimento = a.dimensoes?.comprimentoCm ?? 0;
            const bComprimento = b.dimensoes?.comprimentoCm ?? 0;

            const larguraCompare = compare(aLargura, bLargura, isAsc);
            if (larguraCompare !== 0) {
              return larguraCompare;
            }
            return compare(aComprimento, bComprimento, isAsc);
          }
        case 'ativo':
          return compare(Number(a.ativo), Number(b.ativo), isAsc);
        default:
          return 0;
      }
    });

    this.products.set(sortedData);
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
        await this.loadProducts();
      } catch (error) {
        console.error('Erro ao excluir produto:', error);
        this.snackBar.open(ProductList.Texts.deleteError, 'Fechar', { duration: 3000 });
      }
    }
  }

  onView(product: Product): void {
    const dialogData: ProductFormData = { product, isEditMode: false, title: 'Detalhes do Produto' };
    this.dialog.open(ProductFormComponent, {
      data: dialogData,
      width: '800px',
    });
  }

  async onEdit(product: Product): Promise<void> {
    try {
      this.isLoading.set(true);
      const fullProduct = await lastValueFrom(this.productsService.getProductById(product.id));
      this.openProductDialog({ product: fullProduct, isEditMode: true, title: 'Editar Produto' }, ProductList.Texts.saveSuccess);
    } catch (error) {
      console.error('Erro ao buscar detalhes do produto para edição:', error);
      this.snackBar.open('Não foi possível carregar os dados para edição.', 'Fechar', { duration: 3000 });
    } finally {
      this.isLoading.set(false);
    }
  }

  onCreate(): void {
    const newProduct: Partial<Product> = {
      nome: '',
      sku: '',
      descricao: '',
      cor: '',
      unidadesPorProduto: 1,
      ativo: true,
      dimensoes: { larguraCm: 0, comprimentoCm: 0 },
    };

    this.openProductDialog({
      product: newProduct as Product,
      isEditMode: false,
      isCreationMode: true,
      title: 'Cadastrar Produto'
    }, ProductList.Texts.createSuccess);
  }

  private openProductDialog(dialogData: ProductFormData, successMessage: string): void {
    const dialogRef = this.dialog.open(ProductFormComponent, {
      data: dialogData,
      width: '800px',
    });

    dialogRef.afterClosed().pipe(filter(result => result === true)).subscribe(() => {
      this.snackBar.open(successMessage, 'Fechar', { duration: 3000 });
      this.loadProducts();
    });
  }

  getChannelDisplayName(channelKey: string): string {
    return CHANNEL_NAME_MAP.get(channelKey) || channelKey;
  }
}

function compare(a: number | string, b: number | string, isAsc: boolean) {
  return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
}
