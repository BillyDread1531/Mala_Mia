import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Las columnas id/FK de MySQL son BigInt (UnsignedBigInt) y Prisma las mapea
 * a `bigint`, que JSON.stringify no sabe serializar. Los montos son
 * Prisma.Decimal (decimal.js): tienen su propio toJSON, pero se pierde si
 * reconstruimos el objeto a mano como hacemos abajo. Convertimos ambos a
 * string en toda la respuesta para que cualquier módulo pueda devolver
 * entidades de Prisma sin mapear cada campo manualmente.
 */
@Injectable()
export class BigIntInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(map((data: unknown) => this.transform(data)));
  }

  private transform(value: unknown): unknown {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    if (value instanceof Prisma.Decimal) {
      return value.toString();
    }
    if (Array.isArray(value)) {
      return value.map((item: unknown) => this.transform(item));
    }
    if (value instanceof Date) {
      return value;
    }
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, this.transform(item)]),
      );
    }
    return value;
  }
}
