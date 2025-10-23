import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatUnit',
  standalone: true,
})
export class FormatUnitPipe implements PipeTransform {

  transform(value: unknown, ...args: unknown[]): unknown {
    return null;
  }

}
