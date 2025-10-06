import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { StockService } from '../../services/stock';
import { Stock } from '../../models/stock.model';

@Component({
  selector: 'app-batch-list',
  imports: [CommonModule, MatTableModule],
  templateUrl: './batch-list.html',
  styleUrl: './batch-list.scss',
  standalone: true,
})
export class BatchList implements OnInit {
  private readonly stockService = inject(StockService);

  stock = signal<Stock[]>([]);
  displayedColumns: string[] = ['nome', 'quantidadePacotes', 'quantidadePorPacote'];

  ngOnInit(): void {
    this.loadStock();
  }

  loadStock(): void {
    this.stockService.getStock().subscribe(data => this.stock.set(data));
  }
}
