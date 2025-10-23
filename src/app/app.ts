import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { TopNavbar } from './layout/top-navbar';
import { Footer } from './layout/footer';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, TopNavbar, Footer],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('dcriar');
}
