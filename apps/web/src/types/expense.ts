export interface Expense {
  id: string;
  category: { id: string; name: string };
  description: string;
  amount: string;
  expenseDate: string;
  paymentMethod: { id: string; name: string };
  notes: string | null;
  status: 'COMPLETED' | 'VOIDED';
  createdByName: string;
  createdAt: string;
}

export interface ExpenseListResponse {
  items: Expense[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ExpenseFormInput {
  categoryId: number;
  description: string;
  amount: number;
  paymentMethodId: number;
  expenseDate?: string;
  notes?: string;
}
