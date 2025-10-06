import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Inject, OnInit, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef, } from '@angular/material/dialog';
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

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatSelectModule, MatInputModule, MatButtonModule, MatCheckboxModule, MatIconModule],
  templateUrl: './product-form.html',
  styleUrls: ['./product-form.scss']
})
export class ProductFormComponent implements OnInit {
  product!: Product;
  isEditMode: boolean;

  productForm: FormGroup;
  private readonly productsService = inject(ProductsService);
  private readonly materialTypeService = inject(MaterialTypeService);
  private readonly cdr = inject(ChangeDetectorRef);

  materialTypes = signal<MaterialType[]>([]);

  // Filtros para busca de matéria-prima
  searchName: string = '';
  searchUnit: string = '';
  selectedFile: File | null = null;
  isSearching = false;

  // Opções para o filtro de unidade de consumo
  consumptionUnits = [
    { value: 'CENTIMETRO_QUADRADO', viewValue: 'Centímetro Quadrado' },
    { value: 'UNIDADE', viewValue: 'Unidade' },
    { value: 'METRO_LINEAR', viewValue: 'Metro Linear' }
  ];

  constructor(
    public dialogRef: MatDialogRef<ProductFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ProductFormData,
    private readonly fb: FormBuilder
  ) {
    this.product = data.product;
    this.isEditMode = !!data.isEditMode;

    this.productForm = this.fb.group({
      nome: [this.product.nome, Validators.required],
      sku: [this.product.sku, Validators.required],
      descricao: [this.product.descricao],
      cor: [this.product.cor],
      unidadesPorProduto: [this.product.unidadesPorProduto, [Validators.required, Validators.min(1)]],
      ativo: [this.product.ativo],
      tipoMateriaPrima: this.fb.group({
        id: [this.product.tipoMateriaPrima?.id, Validators.required]
      }),
      dimensoesUnitarias: this.fb.group({
        larguraCm: [this.product.dimensoesUnitarias?.larguraCm, [Validators.required, Validators.min(0.1)]],
        comprimentoCm: [this.product.dimensoesUnitarias?.comprimentoCm, [Validators.required, Validators.min(0.1)]]
      })
    });
  }

  onSubmit(): void {
    if (this.productForm.invalid) {
      return; // Impede o envio se o formulário for inválido
    }

    const formValue = this.productForm.value;
    const payload = {
      ...formValue,
      tipoMateriaPrimaId: formValue.tipoMateriaPrima.id,
    };
    // Remove o form group aninhado para não ser enviado no payload
    delete payload.tipoMateriaPrima;

    if (this.isEditMode) {
      const updateUrl = this.product._links['atualizar-produto']?.href;
      if (updateUrl) {
        this.productsService.patchProduct(updateUrl, payload).subscribe({
          next: () => {
            this.dialogRef.close(true); // Fecha o diálogo e sinaliza sucesso
          },
          error: error => console.error('Erro ao atualizar o produto:', error)
        });
      } else {
        console.error('URL de atualização não encontrada para o produto.');
      }
    } else { // Modo de Criação
      this.productsService.createProduct(payload).subscribe({
        next: () => {
          this.dialogRef.close(true);
        },
        error: error => console.error('Erro ao criar o produto:', error)
      });
    }
  }

  ngOnInit(): void {
    if (this.isEditMode) {
      // Garante que a matéria-prima atual do produto esteja na lista de opções.
      if (this.product.tipoMateriaPrima) {
        this.materialTypes.set([this.product.tipoMateriaPrima]);
      }
    }

    // Garante que `dimensoesUnitarias` exista e seja populado corretamente.
    if (this.product) {
      if (this.product.dimensoes && !this.product.dimensoesUnitarias) {
        // Se `dimensoes` existe (vindo da API) mas `dimensoesUnitarias` não, mapeia os valores.
        // Isso é útil para o modo de edição.
        this.product.dimensoesUnitarias = {
          larguraCm: this.product.dimensoes.largura, // Mapeia para o formulário
          comprimentoCm: this.product.dimensoes.comprimento // Mapeia para o formulário
        };
        this.productForm.patchValue({ dimensoesUnitarias: this.product.dimensoesUnitarias });
      }
    }
  }

  performSearch(): void {
    this.isSearching = true;
    this.materialTypeService.searchMaterialTypes({
      nome: this.searchName,
      unidadeDeConsumo: this.searchUnit
    }).subscribe(types => {
      // Adiciona a matéria-prima atual à lista de resultados, se não estiver presente.
      this.materialTypes.set(types);
      this.isSearching = false;
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
    }
  }

  onUpload(): void {
    if (this.selectedFile && this.product.id) {
      // ETAPA 1: Fazer o upload da imagem para o endpoint genérico
      this.productsService.uploadImage(this.selectedFile).subscribe({
        next: (uploadResponse) => {
          const imageUrl = uploadResponse.fileDownloadUri;
          const updateUrl = this.product._links['atualizar-produto']?.href;

          if (updateUrl) {
            // Etapa 2: Atualizar o produto com a URL da imagem recebida
            this.productsService.updateProductPhotoUrl(updateUrl, this.product, imageUrl).subscribe(updatedProduct => {
              this.product.fotoPrincipalUrl = updatedProduct.fotoPrincipalUrl; // Atualiza a interface do usuário
              this.selectedFile = null; // Limpa a seleção do arquivo
              this.cdr.detectChanges(); // Notifica o Angular para atualizar a view
            });
          }
        },
        error: (err) => console.error('Falha no upload da imagem:', err),
      });
    }
  }

  getConsumptionUnitViewValue(value: string): string {
    const unit = this.consumptionUnits.find(u => u.value === value);
    return unit ? unit.viewValue : value;
  }
}

export interface ProductFormData {
  product: Product;
  isEditMode: boolean;
  isCreationMode?: boolean;
}
