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
    sales: { path: 'sales', label: 'Vendas', icon: 'point_of_sale' },
    'ordens-de-producao': { path: 'ordens-de-producao', label: 'Produção', icon: 'content_cut' },
    'lotes-materia-prima': { path: 'lotes-materia-prima', label: 'Lotes', icon: 'view_in_ar' },
    'tipos-materia-prima': { path: 'tipos-materia-prima', label: 'Matérias-Primas', icon: 'category' },
  };

  get availableNavLinks(): NavLink[] {
    const endpoints = this.apiRoot.endpoints();
    if (!endpoints) {
      return [];
    }

    return Object.keys(endpoints._links)
      .map((key) => this.navLinksMap[key])
      .filter(
        (navLink) => {
          if (!navLink) return false;
          // Permite o link 'produtos' mesmo que seja templado, pois a rota base funciona.
          if (navLink.path === 'produtos') return true;
          // Para os outros links, mantém a lógica original de não mostrar se for templado.
          return !endpoints._links[navLink.path]?.templated;
        }
      );
  }
}
