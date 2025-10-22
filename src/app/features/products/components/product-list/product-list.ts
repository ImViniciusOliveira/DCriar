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
import { ApiRoot } from '../../../../core/services/api-root';

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
  private readonly apiRoot = inject(ApiRoot);

  products = signal<Product[]>([]);
  isLoading = signal(false);
  displayedColumns: string[] = ['sku', 'nome', 'cor', 'dimensoes', 'ativo', 'estoque', 'estoquePorCanal', 'acoes'];

  totalElements = signal(0);
  pageSize = signal(10);
  pageIndex = signal(0);

  // Controla a ordenação
  sortActive = signal('nome');
  sortDirection = signal<Sort['direction']>('asc');

  private channelStockMap = new Map<number, { [key: string]: number }>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  ngOnInit(): void {
    this.isLoading.set(true);
    // 1. Busca o mapa de estoque APENAS UMA VEZ.
    lastValueFrom(
      this.stockService.getChannelStockMap().pipe(
        catchError((error) => {
          console.error(
            'Erro ao buscar estoque por canal. A tabela será exibida sem esses dados.',
            error
          );
          // Em caso de erro, continua com um mapa vazio para não quebrar a UI.
          return of(new Map<number, { [key: string]: number }>());
        })
      )
    )
      .then((stockMap) => {
        this.channelStockMap = stockMap;
        // 2. Carrega a primeira página de produtos.
        return this.loadProducts();
      })
      .catch((error) => {
        console.error('Erro na inicialização da lista de produtos:', error);
        this.snackBar.open(ProductList.Texts.loadError, 'Fechar', {
          duration: 5000,
        });
      });
  }

  async loadProducts(): Promise<void> {
    this.isLoading.set(true);
    try {
      console.log('[ProductList] loadProducts: Carregando com ordenação:', { active: this.sortActive(), direction: this.sortDirection() });
      const sortString = `${this.sortActive()},${this.sortDirection()}`;
      const productsResponse = await lastValueFrom(
        this.productsService.getProducts(this.pageIndex(), this.pageSize(), sortString)
      );

      this.totalElements.set(productsResponse.page?.totalElements || 0);
      const products = productsResponse?._embedded?.produtos || [];
      const baseChannelStock = Object.fromEntries(Array.from(CHANNEL_NAME_MAP.keys()).map(key => [key, 0]));

      const mergedProducts = products.map((product: Product) => {
        const productChannelStock = this.channelStockMap.get(product.id) || {};
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
    console.log('[ProductList] sortData: Evento de ordenação recebido:', sort);
    // Se a direção da ordenação for vazia, volta para o padrão (nome, asc)
    this.sortActive.set(sort.direction ? sort.active : 'nome');
    this.sortDirection.set(sort.direction || 'asc');

    // Ao mudar a ordenação, sempre volte para a primeira página.
    if (this.paginator && this.paginator.pageIndex !== 0) {
      this.paginator.firstPage();
    } else {
      // Se já estiver na primeira página, apenas carrega os produtos com a nova ordenação.
      this.loadProducts();
    }
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

  async onView(product: Product): Promise<void> {
    try {
      this.isLoading.set(true);
      // Busca o produto completo para garantir que todos os links HATEOAS estão presentes.
      const fullProduct = await lastValueFrom(this.productsService.getProductById(product.id));
      const dialogData: ProductFormData = { product: fullProduct, isEditMode: false, title: 'Detalhes do Produto' };
      this.dialog.open(ProductFormComponent, {
        data: dialogData,
        width: '800px',
      });
    } catch (error) {
      console.error('Erro ao buscar detalhes do produto para visualização:', error);
      this.snackBar.open('Não foi possível carregar os dados para visualização.', 'Fechar', { duration: 3000 });
    } finally {
      this.isLoading.set(false);
    }
  }

  async onEdit(product: Product): Promise<void> {
    try {
      this.isLoading.set(true);
      // Busca o produto completo para garantir que todos os links HATEOAS estão presentes.
      const fullProduct = await lastValueFrom(this.productsService.getProductById(product.id));
      this.openProductDialog({ product: fullProduct, isEditMode: true, title: 'Editar Produto' }, ProductList.Texts.saveSuccess);
    } catch (error) {
      console.error('Erro ao buscar detalhes do produto para edição:', error);
      this.snackBar.open('Não foi possível carregar os dados para edição.', 'Fechar', { duration: 3000 });
    } finally {
      this.isLoading.set(false);
    }
  }

  async onCreate(): Promise<void> {
    try {
      this.isLoading.set(true);
      // Garante que a API raiz foi carregada para termos acesso aos links principais.
      await lastValueFrom(this.apiRoot.endpoints$);

      // Busca o "molde" do produto do backend.
      const newProductTemplate = await lastValueFrom(this.productsService.getNewProductTemplate());

      this.openProductDialog({
        product: newProductTemplate,
        isEditMode: false,
        isCreationMode: true,
        title: 'Cadastrar Produto'
      }, ProductList.Texts.createSuccess);
    } catch (error) {
      console.error('Erro ao buscar template para novo produto:', error);
      this.snackBar.open('Não foi possível iniciar o cadastro de um novo produto.', 'Fechar', { duration: 3000 });
    } finally {
      this.isLoading.set(false);
    }
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
