import { InfiniteScrollDirective } from './../../../stock/services/infinite-scroll.directive';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Inject, OnInit, WritableSignal, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Product } from '../../models/products.model';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProductsService } from '../../services/products';
import { MaterialTypeService } from '../../../stock/services/material-type.service';
import { MaterialType } from '../../../stock/models/material-type.model';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { ConfirmDialog, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog/confirm-dialog';
import { lastValueFrom } from 'rxjs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Constantes do módulo, não precisam pertencer à classe.
const CONSUMPTION_UNITS = [
  { value: 'CENTIMETRO_QUADRADO', viewValue: 'Centímetro Quadrado' },
  { value: 'UNIDADE', viewValue: 'Unidade' },
  { value: 'METRO_LINEAR', viewValue: 'Metro Linear' }
];

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatSelectModule, MatInputModule, MatButtonModule, MatCheckboxModule, MatIconModule, InfiniteScrollDirective, MatProgressSpinnerModule],
  templateUrl: './product-form.html',
  styleUrls: ['./product-form.scss']
})
export class ProductFormComponent implements OnInit {
  // Constantes para o diálogo de confirmação, facilitando a manutenção.
  private static readonly CONFIRM_CHANGE_TITLE = 'Confirmar Alteração';
  private static readonly CONFIRM_CHANGE_MESSAGE = (original: string, novo: string) =>
    `Deseja realmente alterar a matéria-prima de "${original}" para "${novo}"?`;

  product!: Product;
  isEditMode: boolean;

  productForm: FormGroup;
  private readonly productsService = inject(ProductsService);
  private readonly materialTypeService = inject(MaterialTypeService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialog = inject(MatDialog);

  searchForm: FormGroup;
  materialTypes: WritableSignal<MaterialType[]> = signal([]);
  selectedFile: File | null = null;
  isSearching = signal(false);
  isUploading = signal(false);

  // Estado da Paginação
  private readonly currentPage = signal(0);
  private readonly pageSize = 20;
  private readonly totalElements = signal(0);
  private readonly materialTypesSearchUrl: string | null = null;

  // Expõe a constante para o template.
  readonly consumptionUnits = CONSUMPTION_UNITS;

  constructor(
    public dialogRef: MatDialogRef<ProductFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ProductFormData,
    private readonly fb: FormBuilder
  ) {
    this.product = data.product;
    this.isEditMode = !!data.isEditMode;

    const searchUrl = this.product?._links?.['buscar-tipos-materia-prima']?.href;
    if (searchUrl) {
      this.materialTypesSearchUrl = searchUrl.split('{')[0];
    }

    this.productForm = this.fb.group({
      nome: [this.product.nome, Validators.required],
      sku: [this.product.sku, Validators.required],
      descricao: [this.product.descricao],
      cor: [this.product.cor],
      unidadesPorProduto: [this.product.unidadesPorProduto, [Validators.required, Validators.min(1)]],
      ativo: [this.product.ativo],
      tipoMateriaPrima: [this.product.tipoMateriaPrima, Validators.required],
      dimensoesUnitarias: this.fb.group({
        larguraCm: [this.product.dimensoesUnitarias?.larguraCm, [Validators.required, Validators.min(0.1)]],
        comprimentoCm: [this.product.dimensoesUnitarias?.comprimentoCm, [Validators.required, Validators.min(0.1)]]
      })
    });

    this.searchForm = this.fb.group({
      searchName: [''],
      searchUnit: ['']
    });
  }

  async onSubmit(): Promise<void> {
    if (this.productForm.invalid) {
      return; // Impede o envio se o formulário for inválido
    }

    try {
      const formValue = this.productForm.value;
      const payload = {
        ...formValue,
        tipoMateriaPrimaId: formValue.tipoMateriaPrima?.id,
      };
      delete payload.tipoMateriaPrima;

      if (this.isEditMode) {
        const updateUrl = this.product._links['atualizar-produto']?.href;
        if (!updateUrl) {
          console.error('URL de atualização não encontrada para o produto.');
          return;
        }
        await lastValueFrom(this.productsService.patchProduct(updateUrl, payload));
      } else { // Modo de Criação
        await lastValueFrom(this.productsService.createProduct(payload));
      }

      this.dialogRef.close(true); // Fecha o diálogo e sinaliza sucesso
    } catch (error) {
      console.error(this.isEditMode ? 'Erro ao atualizar o produto:' : 'Erro ao criar o produto:', error);
    }
  }

  ngOnInit(): void {
    if (this.isEditMode) {
      if (this.product.tipoMateriaPrima) {
        this.materialTypes.set([this.product.tipoMateriaPrima]);
      }
    }

    if (this.product) {
      if (this.product.dimensoes && !this.product.dimensoesUnitarias) {
        // Mapeia o objeto `dimensoes` (da API) para `dimensoesUnitarias` (do formulário)
        // para popular os campos de dimensão no modo de edição.
        this.product.dimensoesUnitarias = {
          larguraCm: this.product.dimensoes.largura,
          comprimentoCm: this.product.dimensoes.comprimento
        };
        this.productForm.patchValue({ dimensoesUnitarias: this.product.dimensoesUnitarias });
      }
    }
  }

  async performSearch(): Promise<void> {
    this.isSearching.set(true);

    try {
      this.currentPage.set(0); // Reseta a página

      // No modo de edição, mantém a matéria-prima atual na lista para não perdê-la de vista ao filtrar.
      const initialMaterialTypes = (this.isEditMode && this.product.tipoMateriaPrima)
        ? [this.product.tipoMateriaPrima]
        : [];
      this.materialTypes.set(initialMaterialTypes);

      if (!this.materialTypesSearchUrl) {
        console.error("Não é possível buscar matérias-primas: URL não encontrada no produto.");
        return;
      }

      const filters = this.searchForm.value;

      const response = await lastValueFrom(
        this.materialTypeService.searchMaterialTypes(
          this.materialTypesSearchUrl,
          filters,
          this.currentPage(),
          this.pageSize
        )
      );

      const newMaterials = response._embedded['tipos-materia-prima'];

      // Adiciona os novos resultados, evitando duplicatas caso o item atual já esteja na lista.
      this.materialTypes.update(currentTypes => {
        const currentIds = new Set(currentTypes.map(t => t.id));
        const filteredNew = newMaterials.filter(t => !currentIds.has(t.id));
        return [...currentTypes, ...filteredNew];
      });
      this.totalElements.set(response.page.totalElements);
    } catch (err) {
      console.error('Erro na busca por matéria-prima:', err);
    } finally {
      this.isSearching.set(false);
    }
  }

  async loadMore(): Promise<void> {
    // Previne múltiplas chamadas e só carrega mais se houver itens restantes.
    if (this.isSearching() || this.materialTypes().length >= this.totalElements()) {
      return;
    }

    this.isSearching.set(true);

    try {
      this.currentPage.update(page => page + 1);

      if (!this.materialTypesSearchUrl) return;

      const filters = this.searchForm.value;

      const response = await lastValueFrom(this.materialTypeService.searchMaterialTypes(this.materialTypesSearchUrl, filters, this.currentPage(), this.pageSize));

      this.materialTypes.update(currentTypes => [...currentTypes, ...response._embedded['tipos-materia-prima']]);
    } catch (err) {
      console.error('Erro ao carregar mais matérias-primas:', err);
    } finally {
      this.isSearching.set(false);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
    }
  }

  async onUpload(): Promise<void> {
    if (this.selectedFile && this.product.id) {
      this.isUploading.set(true);
      try {
        // 1. Fazer o upload da imagem
        const uploadResponse = await lastValueFrom(this.productsService.uploadImage(this.selectedFile));
        const imageUrl = uploadResponse.fileDownloadUri;
        const updateUrl = this.product._links['atualizar-produto']?.href;

        if (!updateUrl) {
          console.error('URL de atualização não encontrada para o produto.');
          return;
        }
        // 2. Atualizar o produto com a URL da imagem
        const updatedProduct = await lastValueFrom(this.productsService.updateProductPhotoUrl(updateUrl, this.product, imageUrl));
        this.product.fotoPrincipalUrl = updatedProduct.fotoPrincipalUrl; // Atualiza a interface
        this.selectedFile = null; // Limpa a seleção do arquivo
        this.cdr.detectChanges(); // Notifica o Angular para atualizar a view
      } catch (err) {
        console.error('Falha no upload da imagem:', err);
      } finally {
        this.isUploading.set(false);
      }
    }
  }

  getConsumptionUnitViewValue(value: string): string {
    const unit = CONSUMPTION_UNITS.find(u => u.value === value);
    return unit ? unit.viewValue : value;
  }

  compareMaterialTypes(o1: MaterialType, o2: MaterialType): boolean {
    return o1 && o2 ? o1.id === o2.id : o1 === o2;
  }

  async onMaterialTypeChange(event: { value: MaterialType }): Promise<void> {
    const newSelection = event.value;
    const originalSelection = this.product.tipoMateriaPrima;

    // Só exibe o diálogo de confirmação se a matéria-prima for realmente alterada.
    if (!originalSelection || !newSelection || originalSelection.id === newSelection.id) {
      return;
    }

    const dialogData: ConfirmDialogData = {
      title: ProductFormComponent.CONFIRM_CHANGE_TITLE,
      message: ProductFormComponent.CONFIRM_CHANGE_MESSAGE(originalSelection.nome, newSelection.nome)
    };

    const dialogRef = this.dialog.open(ConfirmDialog, { data: dialogData });
    const confirmed = await lastValueFrom(dialogRef.afterClosed());

    if (!confirmed) {
      // Se o usuário cancelar, reverte a seleção no formulário para o valor original.
      this.productForm.get('tipoMateriaPrima')?.setValue(originalSelection);
    }
  }
}

export interface ProductFormData {
  product: Product;
  isEditMode: boolean;
  isCreationMode?: boolean;
}
