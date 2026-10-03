export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  contactPerson: string | null;
  address: string | null;
  social: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface SupplierListItem extends Supplier {
  purchaseCount: number;
  lastPurchaseDate: string | null;
  totalPurchased: string;
}

export interface SupplierFormInput {
  name: string;
  phone?: string;
  whatsapp?: string;
  contactPerson?: string;
  address?: string;
  social?: string;
  notes?: string;
}

export type UpdateSupplierInput = Partial<SupplierFormInput>;
