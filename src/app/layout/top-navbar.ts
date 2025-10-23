import { Component, inject } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { ApiRoot } from '../core/services/api-root';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

// Define a estrutura de um link de navegação
type NavLink = { path: string; label: string; icon?: string };

@Component({
  selector: 'app-top-navbar',
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    RouterModule,
    MatIconModule,
  ],
  templateUrl: './top-navbar.html',
  styleUrl: './top-navbar.scss',
  standalone: true,
})
export class TopNavbar {
  apiRoot = inject(ApiRoot);

  readonly navLinksMap: Record<string, NavLink> = {
    dashboard: { path: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    produtos: { path: 'produtos', label: 'Produtos', icon: 'inventory_2' },
    vendas: { path: 'vendas', label: 'Vendas', icon: 'point_of_sale' },
    'ordens-de-corte': { path: 'ordens-de-corte', label: 'Ordens de Corte', icon: 'content_cut' },
    'lotes-materia-prima': { path: 'lotes-materia-prima', label: 'Lotes', icon: 'view_in_ar' },
    'tipos-materia-prima': { path: 'tipos-materia-prima', label: 'Matérias-Primas', icon: 'category' },
  };

  get availableNavLinks(): NavLink[] {
    const endpoints = this.apiRoot.endpoints();
    if (!endpoints) {
      return [];
    }

    // Use as chaves do navLinksMap como fonte da verdade para a ordem e disponibilidade.
    return Object.keys(this.navLinksMap)
      .map((key) => this.navLinksMap[key])
      .filter(
        (navLink) => {
          if (!navLink) return false;
          // Verifica se o endpoint correspondente existe na API.
          // A chave no navLinksMap deve corresponder à chave no _links da API.
          const endpointKey = Object.keys(this.navLinksMap).find(k => this.navLinksMap[k].path === navLink.path);
          return endpointKey ? !!endpoints._links[endpointKey] : false;
        }
      );
  }
}
