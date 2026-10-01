import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listCategories() {
    return this.prisma.categories.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
    });
  }

  listSizes() {
    return this.prisma.sizes.findMany({
      where: { is_active: true },
      orderBy: { id: 'asc' },
    });
  }

  listColors() {
    return this.prisma.colors.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
    });
  }

  listPaymentMethods() {
    return this.prisma.payment_methods.findMany({
      where: { is_active: true, applies_to_purchases: true },
      orderBy: { name: 'asc' },
    });
  }
}
