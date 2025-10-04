import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ApiRoot } from '../../../core/services/api-root';

@Component({
  selector: 'app-dashboard-page',
  imports: [CommonModule],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
  standalone: true,
})
export class DashboardPage implements OnInit {
  apiRoot = inject(ApiRoot);
  objectKeys = Object.keys;

  ngOnInit(): void {
    this.apiRoot.loadEndpoints().subscribe();
  }
}
