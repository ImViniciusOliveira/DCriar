import { InfiniteScrollDirective } from './../../../stock/services/infinite-scroll.directive';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Inject, OnInit, WritableSignal, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Product } from '../../models/products.model';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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

  private readonly currentPage = signal(0);
  private readonly pageSize = 20;
  private readonly totalElements = signal(0);
  private readonly materialTypesSearchUrl: string | null = null;

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
      materiaPrima: [this.product.materiaPrima, Validators.required],
      dimensoes: this.fb.group({
        larguraCm: [this.product.dimensoes?.larguraCm, [Validators.required, Validators.min(0.1)]],
        comprimentoCm: [this.product.dimensoes?.comprimentoCm, [Validators.required, Validators.min(0.1)]]
      })
    });

    this.searchForm = this.fb.group({
      searchName: [''],
      searchUnit: ['']
    });
  }

  async onSubmit(): Promise<void> {
    if (this.productForm.invalid) {
      return;
    }

    try {
      const dirtyValues = this.getDirtyValues(this.productForm);

      if (this.isEditMode) {
        if (!this.product.id) {
          console.error('ID do produto não encontrado, não é possível atualizar.', this.product);
          return;
        }
        this.product = await lastValueFrom(this.productsService.patchProduct(this.product.id, dirtyValues));
      } else { // Modo de Criação
        const formValue = { ...this.productForm.value };
        if (formValue.materiaPrima?.id) {
          formValue.materiaPrima = { id: formValue.materiaPrima.id };
        }
        await lastValueFrom(this.productsService.createProduct(formValue));
      }

      this.dialogRef.close(true);
    } catch (error) {
      console.error(this.isEditMode ? 'Erro ao atualizar o produto:' : 'Erro ao criar o produto:', error);
    }
  }

  ngOnInit(): void {
    if (this.isEditMode) {
      if (this.product.materiaPrima) {
        this.materialTypes.set([this.product.materiaPrima]);
      }
    }
  }

  async performSearch(): Promise<void> {
    this.isSearching.set(true);

    try {
      this.currentPage.set(0);

      const initialMaterialTypes = (this.isEditMode && this.product.materiaPrima)
        ? [this.product.materiaPrima]
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
    let uploadUrl = this.product?._links?.['upload-foto']?.href;
    if (this.selectedFile && uploadUrl) {
      this.isUploading.set(true);
      try {
        if (!uploadUrl.endsWith('/')) {
          uploadUrl += '/';
        }
        const updatedProduct = await lastValueFrom(
          this.productsService.uploadProductPhoto(uploadUrl, this.selectedFile)
        );

        this.product = updatedProduct;
        this.selectedFile = null;
        this.cdr.detectChanges();
      } catch (err) {
        console.error('Falha no upload da imagem:', err);
        // TODO: Adicionar um MatSnackBar para notificar o usuário sobre o erro.
      } finally {
        this.isUploading.set(false);
      }
    }
  }

  private getDirtyValues(form: FormGroup | FormArray): { [key: string]: any } {
    const dirtyValues: { [key: string]: any } = {};
    for (const key of Object.keys(form.controls)) {
      const control = (form.controls as any)[key];

      if (control.dirty) {
        if (control instanceof FormGroup || control instanceof FormArray) {
          const nestedDirtyValues = this.getDirtyValues(control);
          if (Object.keys(nestedDirtyValues).length > 0) {
            dirtyValues[key] = nestedDirtyValues;
          }
        } else {
          dirtyValues[key] = control.value;
        }
      }
    }
    return dirtyValues;
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
    const originalSelection = this.product.materiaPrima;

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
      this.productForm.get('materiaPrima')?.setValue(originalSelection);
    }
  }
}

export interface ProductFormData {
  product: Product;
  isEditMode: boolean;
  isCreationMode?: boolean;
  title: string;
}
