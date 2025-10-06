import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Stock } from '../models/stock.model';

@Injectable({
  providedIn: 'root'
})
export class StockService {
  getStock(): Observable<Stock[]> {
    return of([
      {
        id: 1,
        nome: 'Produto A',
        quantidadePacotes: 10,
        quantidadePorPacote: 5
      },
      {
        id: 2,
        nome: 'Produto B',
        quantidadePacotes: 20,
        quantidadePorPacote: 3
      }
    ]);
  }
}
