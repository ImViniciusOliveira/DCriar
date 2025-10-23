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
    'lotes-materia-prima': { path: 'lotes-materia-prima', label: 'Lotes', icon: 'view_in_ar' },
    'ordens-de-producao': { path: 'ordens-de-producao', label: 'Ordens de Produção', icon: 'content_cut' },
  };

  get availableNavLinks(): NavLink[] {
    const endpoints = this.apiRoot.endpoints();
    if (!endpoints) {
      return [];
    }

    return Object.keys(this.navLinksMap)
      // Filtra as chaves do nosso mapa para incluir apenas aquelas que a API retornou em `_links`.
      .filter(key => key in endpoints._links)
      // Mapeia as chaves filtradas de volta para os objetos NavLink correspondentes.
      .map(key => this.navLinksMap[key]);
  }
}
