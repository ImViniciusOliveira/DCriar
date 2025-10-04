import { Routes } from '@angular/router';
import { DashboardPage } from './features/dashboard/dashboard-page/dashboard-page';
import { ProductList } from './features/products/components/product-list/product-list';
import { SalesList } from './features/sales/components/sales-list/sales-list';
import { CutOrderForm } from './features/production/components/cut-order-form/cut-order-form';
import { BatchList } from './features/stock/components/batch-list/batch-list';
import { MaterialTypeList } from './features/stock/components/material-type-list/material-type-list';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    component: DashboardPage,
  },
  {
    path: 'produtos',
    component: ProductList,
  },
  {
    path: 'sales',
    component: SalesList,
  },
  {
    path: 'ordens-de-producao',
    component: CutOrderForm,
  },
  {
    path: 'lotes-materia-prima',
    component: BatchList,
  },
  {
    path: 'tipos-materia-prima',
    component: MaterialTypeList,
  },
];
