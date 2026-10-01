import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  list(search?: string) {
    const where: Prisma.suppliersWhereInput = { is_active: true };
    if (search?.trim()) {
      where.name = { contains: search.trim() };
    }
    return this.prisma.suppliers.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  create(dto: CreateSupplierDto) {
    return this.prisma.suppliers.create({
      data: {
        name: dto.name.trim(),
        phone: dto.phone?.trim() || null,
        whatsapp: dto.whatsapp?.trim() || null,
        contact_person: dto.contactPerson?.trim() || null,
        address: dto.address?.trim() || null,
        social: dto.social?.trim() || null,
        notes: dto.notes?.trim() || null,
      },
    });
  }
}
