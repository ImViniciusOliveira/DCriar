import { Directive, Output, EventEmitter, AfterViewInit, OnDestroy } from '@angular/core';
import { fromEvent, Subscription } from 'rxjs';
import { debounceTime, map, distinctUntilChanged, filter } from 'rxjs/operators';

@Directive({
  selector: '[appInfiniteScroll]',
  standalone: true,
})
export class InfiniteScrollDirective implements AfterViewInit, OnDestroy {
  @Output() infiniteScroll = new EventEmitter<void>();

  private subscription: Subscription | null = null;
  private observer: MutationObserver | null = null;

  ngAfterViewInit(): void {
    // O painel do mat-select é adicionado ao corpo do documento, não dentro do componente.
    // Usamos um MutationObserver para detectar quando ele é adicionado.
    this.observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        const selectPanel = Array.from(mutation.addedNodes).find(
          (node): node is HTMLElement => node instanceof HTMLElement && node.classList.contains('mat-mdc-select-panel')
        );

        if (selectPanel) {
          this.subscription = fromEvent(selectPanel, 'scroll')
            .pipe(
              debounceTime(200),
              map(event => event.target as HTMLElement),
              filter(target => target.scrollTop + target.clientHeight >= target.scrollHeight - 20), // 20px de margem
              distinctUntilChanged()
            )
            .subscribe(() => this.infiniteScroll.emit());
          this.observer?.disconnect(); // Paramos de observar após encontrar o painel
          break;
        }
      }
    });

    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.observer?.disconnect();
  }
}
