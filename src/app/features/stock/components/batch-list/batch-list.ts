import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';

@Component({
  selector: 'app-batch-list',
  imports: [CommonModule, MatTableModule],
  templateUrl: './batch-list.html',
  styleUrl: './batch-list.scss',
  standalone: true,
})
export class BatchList {
  // TODO: Implementar a lógica de listagem de lotes de matéria-prima.
}
