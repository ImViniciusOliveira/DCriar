import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Hateoas } from '../models/hateoas.model';
import { Observable, tap, shareReplay } from 'rxjs';
import { environment } from './environment';

@Injectable({
  providedIn: 'root',
})
export class ApiRoot {
  private readonly http = inject(HttpClient);

  private readonly API_URL = `${environment.apiUrl}/api/v1`;

  endpoints = signal<Hateoas | undefined>(undefined);

  endpoints$: Observable<Hateoas>;

  constructor() {
    // O shareReplay garante que a requisição só será feita uma vez.
    this.endpoints$ = this.loadEndpoints();
    this.endpoints$.subscribe();
  }

  loadEndpoints(): Observable<Hateoas> {
    return this.http
      .get<Hateoas>(this.API_URL)
      .pipe(
        tap(endpoints => this.endpoints.set(endpoints)),
        shareReplay(1) // Evita múltiplas chamadas para a raiz da API
      );
  }
}
