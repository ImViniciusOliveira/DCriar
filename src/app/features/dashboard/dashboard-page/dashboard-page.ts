import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ApiRoot } from '../../../core/services/api-root';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-dashboard-page',
  imports: [CommonModule, MatListModule, MatButtonModule],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
  standalone: true,
})
export class DashboardPage {
  apiRoot = inject(ApiRoot);
  objectKeys = Object.keys;
}
