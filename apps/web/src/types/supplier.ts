export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  contact_person: string | null;
  address: string | null;
  social: string | null;
  notes: string | null;
  is_active: boolean;
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
