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
import { filter, catchError, of, lastValueFrom, forkJoin, map, take, switchMap } from 'rxjs';
import { ProductFormComponent, ProductFormData } from '../product-form/product-form';;
import { MatCardModule } from '@angular/material/card';
import { ApiRoot } from '../../../../core/services/api-root';
import { SalesChannelService } from '../../services/sales-channel.service';
import { EnumOption, EnumService } from '../../../../core/services/enum.service';

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
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly apiRoot = inject(ApiRoot);
  private readonly salesChannelService = inject(SalesChannelService);
  private readonly enumService = inject(EnumService);

  private channelNameMap = new Map<string, string>(); // Pode ser convertido para signal se houver necessidade de reatividade

  products = signal<Product[]>([]);
  isLoading = signal(false);
  displayedColumns: string[] = ['sku', 'nome', 'cor', 'dimensoes', 'ativo', 'estoque', 'estoquePorCanal', 'acoes'];

  totalElements = signal(0);
  pageSize = signal(10);
  pageIndex = signal(0);

  // Controla a ordenação
  sortActive = signal('nome');
  sortDirection = signal<Sort['direction']>('asc');

  // Usar um signal para o mapa de unidades de consumo para consistência e reatividade
  readonly consumptionUnitsMap = signal(new Map<string, EnumOption>());

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  ngOnInit(): void {
    this.loadProducts();
    // Carrega o mapa de unidades de consumo para "traduzir" os valores na tabela
    this.apiRoot.endpoints$.pipe(
      filter(endpoints => !!endpoints), // Garante que os endpoints da API raiz foram carregados
      map(endpoints => endpoints._links?.['unidades-de-medida']?.href), // Obtém o link HATEOAS
      filter((url): url is string => !!url), // Garante que a URL existe
      take(1), // Pega o primeiro valor e completa
      switchMap(url => this.enumService.getConsumptionUnitsMap(url)) // Usa o novo método do EnumService
    ).subscribe(map => {
      console.log('[ProductList] Mapa de unidades de consumo carregado:', map);
      this.consumptionUnitsMap.set(map); // Atualiza o signal
    });
    // Carrega o mapa de nomes de canais uma vez para uso no template
    this.salesChannelService.channelNameMap$.pipe(take(1)).subscribe((mapData) => {
      this.channelNameMap = mapData;
    });
  }

  loadProducts(): void {
    this.isLoading.set(true);
    console.log('[ProductList] Iniciando carregamento completo...');

    // 1. GARANTE que os canais de venda estejam carregados ANTES de tudo.
    this.salesChannelService.channelKeys$.pipe(
      take(1), // Pega o valor atual (ou o primeiro emitido) e completa.

      // 2. COM OS CANAIS PRONTOS, busca os produtos.
      // switchMap cancela a operação anterior e inicia uma nova (busca de produtos).
      switchMap(() => {
        console.log('[ProductList] Mapa de canais está pronto. Buscando produtos...');
        const sortString = `${this.sortActive()},${this.sortDirection()}`;
        return this.productsService.getProducts(this.pageIndex(), this.pageSize(), sortString);
      }),

      // 3. COM OS PRODUTOS EM MÃOS, busca o estoque de todos em paralelo.
      switchMap(productsResponse => {
        const products = productsResponse?._embedded?.produtos || [];
        this.totalElements.set(productsResponse.page?.totalElements || 0);

        if (products.length === 0) {
          console.log('[ProductList] Nenhum produto encontrado. Encerrando fluxo.');
          return of([]); // Retorna um array vazio para o subscribe final.
        }

        console.log(`[ProductList] Produtos recebidos. Buscando estoque para ${products.length} produtos...`);
        const stockObservables = products.map(product =>
          this.productsService.getChannelStock(product).pipe(
            map(stock => ({ productId: product.id, stock })),
            catchError(() => of({ productId: product.id, stock: {} })) // Em caso de erro, não quebra a cadeia.
          )
        );

        // forkJoin espera todas as chamadas de estoque terminarem.
        // Usamos um map para combinar a lista original de produtos com os estoques recebidos.
        return forkJoin(stockObservables).pipe(
          map(stocks => this.mergeStockData(products, stocks))
        );
      })
    ).subscribe({
      // 4. O SUBSCRIBE FINAL apenas recebe os dados prontos e atualiza a UI.
      next: (finalProducts) => {
        console.log('[ProductList] Dados finais mesclados. Atualizando a tabela.');
        this.products.set(finalProducts);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Erro ao carregar produtos:', error);
        this.snackBar.open(ProductList.Texts.loadError, 'Fechar', { duration: 5000 });
        this.isLoading.set(false);
      }
    });
  }

  // Esta função agora é puramente síncrona. Ela recebe tudo o que precisa e retorna o resultado.
  private mergeStockData(products: Product[], stocks: { productId: number; stock: { [key: string]: number } }[]): Product[] {
    const stockMap = new Map(stocks.map(s => [s.productId, s.stock]));
    const channelKeys = Array.from(this.channelNameMap.keys());
    const baseChannelStock = Object.fromEntries(channelKeys.map(key => [key, 0]));

    return products.map(product => {
      const productSpecificStock = stockMap.get(product.id) || {};
      const finalStock = { ...baseChannelStock, ...productSpecificStock };
      return { ...product, estoquePorCanal: finalStock };
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadProducts();
  }

  sortData(sort: Sort) {
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
        this.loadProducts();
      } catch (error) {
        console.error('Erro ao excluir produto:', error);
        this.snackBar.open(ProductList.Texts.deleteError, 'Fechar', { duration: 3000 });
      }
    }
  }

  async onView(product: Product): Promise<void> {
    try {
      // O objeto 'product' da linha da tabela já contém o estoque e os links necessários.
      // Não é preciso buscar novamente.
      const dialogData: ProductFormData = { product, isEditMode: false, title: 'Detalhes do Produto' };
      this.openProductDialog(dialogData, '');
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
      // Usamos o produto da linha, que já tem os links corretos.
      // A cópia profunda evita que alterações no formulário afetem a tabela antes de salvar.
      const productCopy = structuredClone(product);
      this.openProductDialog({ product: productCopy, isEditMode: true, title: 'Editar Produto' }, ProductList.Texts.saveSuccess);
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
      autoFocus: false,
    });

    dialogRef.afterClosed().pipe(filter(result => result === true)).subscribe(() => {
      this.snackBar.open(successMessage, 'Fechar', { duration: 3000 });
      this.loadProducts();
    });
  }

  getConsumptionUnitViewValue(key: string): string {
    return this.consumptionUnitsMap().get(key)?.viewValue ?? key; // Acessa o valor do signal
  }

  getChannelDisplayName(channelKey: string): string {
    return this.channelNameMap.get(channelKey) || channelKey;
  }

  trackByProductId(index: number, product: Product): number {
    return product.id;
  }
}

function compare(a: number | string, b: number | string, isAsc: boolean) {
  return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
}
