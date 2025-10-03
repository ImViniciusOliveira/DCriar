import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatUnit'
})
export class FormatUnitPipe implements PipeTransform {

  transform(value: unknown, ...args: unknown[]): unknown {
    return null;
  }

}
