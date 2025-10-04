import { Component, inject } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { ApiRoot } from '../core/services/api-root';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-top-navbar',
  imports: [CommonModule, MatToolbarModule, MatButtonModule, RouterModule],
  templateUrl: './top-navbar.html',
  styleUrl: './top-navbar.scss',
  standalone: true,
})
export class TopNavbar {
  apiRoot = inject(ApiRoot);
  objectKeys = Object.keys;
}
