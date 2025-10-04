import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Product } from '../../models/products.model';
import { ProductsService } from '../../services/products';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../../../shared/components/confirm-dialog/confirm-dialog/confirm-dialog';
import { filter } from 'rxjs';
import { ProductFormComponent, ProductFormData } from '../product-form/product-form';

@Component({
  selector: 'app-product-list',
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatDialogModule,
  ],
  templateUrl: './product-list.html',
  styleUrl: './product-list.scss',
  standalone: true,
})
export class ProductList implements OnInit {
  private productsService = inject(ProductsService);
  private dialog = inject(MatDialog);

  products = signal<Product[]>([]);
  displayedColumns: string[] = ['sku', 'nome', 'estoque', 'acoes'];

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.productsService.getProducts().subscribe(response => {
      this.products.set(response._embedded?.produtos || []);
    });
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
      .subscribe(() => {
        const deleteUrl = product._links['deletar-produto']?.href;
        if (deleteUrl) {
          this.productsService.deleteProduct(deleteUrl).subscribe(() => {
            this.loadProducts(); // Recarrega a lista após a exclusão
          });
        }
      });
  }

  onView(product: Product): void {
    const dialogData: ProductFormData = { product, isEditMode: false };
    this.dialog.open(ProductFormComponent, {
      data: dialogData,
      width: '600px',
    });
  }

  onEdit(product: Product): void {
    const dialogData: ProductFormData = { product, isEditMode: true };
    const dialogRef = this.dialog.open(ProductFormComponent, {
      data: dialogData,
      width: '600px',
    });

    dialogRef.afterClosed().pipe(filter(result => result === true)).subscribe(() => {
      this.loadProducts();
    });
  }
}
