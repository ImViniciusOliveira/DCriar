import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { Product } from '../../models/products.model';

@Component({
  selector: 'app-product-details',
  templateUrl: './product-details.html',
  styleUrls: ['./product-details.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class ProductDetailsComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public product: Product,
    private readonly dialogRef: MatDialogRef<ProductDetailsComponent>
  ) {}

  close(): void {
    this.dialogRef.close();
  }
}
