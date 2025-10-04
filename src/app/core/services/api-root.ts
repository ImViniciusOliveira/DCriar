import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Hateoas } from '../models/hateoas.model';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ApiRoot {
  private http = inject(HttpClient);

  private readonly API_URL = '/api/v1';

  endpoints = signal<Hateoas | undefined>(undefined);

  loadEndpoints(): Observable<Hateoas> {
    return this.http
      .get<Hateoas>(this.API_URL)
      .pipe(
        tap(endpoints => {
          this.endpoints.set(endpoints);
        })
      );
  }
}
