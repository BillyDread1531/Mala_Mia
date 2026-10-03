import { Prisma, suppliers } from '@prisma/client';

export interface SupplierView {
  id: bigint;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  contactPerson: string | null;
  address: string | null;
  social: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
}

export function toSupplierView(row: suppliers): SupplierView {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    whatsapp: row.whatsapp,
    contactPerson: row.contact_person,
    address: row.address,
    social: row.social,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export interface SupplierListItemView extends SupplierView {
  purchaseCount: number;
  lastPurchaseDate: Date | null;
  totalPurchased: Prisma.Decimal;
}
