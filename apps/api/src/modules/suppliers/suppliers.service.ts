import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AUDIT_ACTIONS, AuditService } from '../audit/audit.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import {
  SupplierListItemView,
  SupplierView,
  toSupplierView,
} from './suppliers.mapper';

const ZERO = new Prisma.Decimal(0);

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(search?: string): Promise<SupplierView[]> {
    const where: Prisma.suppliersWhereInput = { is_active: true };
    if (search?.trim()) {
      where.name = { contains: search.trim() };
    }
    const rows = await this.prisma.suppliers.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    return rows.map(toSupplierView);
  }

  /**
   * Vista de administración (CONTEXT.md #12 "Proveedores"): incluye
   * inactivos y agrega cantidad de compras/última compra/total comprado.
   * Se agrega en memoria con un solo `groupBy` para no hacer N+1 consultas.
   */
  async listAll(): Promise<SupplierListItemView[]> {
    const [suppliers, stats] = await Promise.all([
      this.prisma.suppliers.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.purchases.groupBy({
        by: ['supplier_id'],
        _count: { _all: true },
        _max: { purchase_date: true },
        _sum: { total_cost: true },
      }),
    ]);
    const statsBySupplier = new Map(
      stats.map((s) => [s.supplier_id.toString(), s]),
    );

    return suppliers.map((row) => {
      const stat = statsBySupplier.get(row.id.toString());
      return {
        ...toSupplierView(row),
        purchaseCount: stat?._count._all ?? 0,
        lastPurchaseDate: stat?._max.purchase_date ?? null,
        totalPurchased: stat?._sum.total_cost ?? ZERO,
      };
    });
  }

  async findOne(id: bigint): Promise<SupplierListItemView> {
    const [supplier, stats] = await Promise.all([
      this.prisma.suppliers.findUnique({ where: { id } }),
      this.prisma.purchases.aggregate({
        where: { supplier_id: id },
        _count: { _all: true },
        _max: { purchase_date: true },
        _sum: { total_cost: true },
      }),
    ]);
    if (!supplier) throw new NotFoundException('Proveedor no encontrado.');

    return {
      ...toSupplierView(supplier),
      purchaseCount: stats._count._all,
      lastPurchaseDate: stats._max.purchase_date,
      totalPurchased: stats._sum.total_cost ?? ZERO,
    };
  }

  async create(dto: CreateSupplierDto): Promise<SupplierView> {
    const created = await this.prisma.suppliers.create({
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
    return toSupplierView(created);
  }

  async update(
    id: bigint,
    dto: UpdateSupplierDto,
    currentUserId: bigint,
  ): Promise<SupplierView> {
    const existing = await this.prisma.suppliers.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Proveedor no encontrado.');

    const updated = await this.prisma.suppliers.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone.trim() || null } : {}),
        ...(dto.whatsapp !== undefined
          ? { whatsapp: dto.whatsapp.trim() || null }
          : {}),
        ...(dto.contactPerson !== undefined
          ? { contact_person: dto.contactPerson.trim() || null }
          : {}),
        ...(dto.address !== undefined
          ? { address: dto.address.trim() || null }
          : {}),
        ...(dto.social !== undefined
          ? { social: dto.social.trim() || null }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
        updated_at: new Date(),
      },
    });
    await this.auditService.record(this.prisma, {
      userId: currentUserId,
      action: AUDIT_ACTIONS.SUPPLIER_UPDATED,
      entityType: 'supplier',
      entityId: id,
      description: `Datos de contacto actualizados: ${updated.name}.`,
    });
    return toSupplierView(updated);
  }

  async setActive(
    id: bigint,
    isActive: boolean,
    currentUserId: bigint,
  ): Promise<SupplierView> {
    const existing = await this.prisma.suppliers.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Proveedor no encontrado.');

    const updated = await this.prisma.suppliers.update({
      where: { id },
      data: { is_active: isActive, updated_at: new Date() },
    });
    await this.auditService.record(this.prisma, {
      userId: currentUserId,
      action: AUDIT_ACTIONS.SUPPLIER_ACTIVE_CHANGED,
      entityType: 'supplier',
      entityId: id,
      description: `Proveedor ${updated.name} ${isActive ? 'reactivado' : 'desactivado'}.`,
      oldValues: { isActive: !isActive },
      newValues: { isActive },
    });
    return toSupplierView(updated);
  }
}
