import { Prisma } from '@prisma/client';

export type ExpenseWithRelations = Prisma.expensesGetPayload<{
  include: { expense_categories: true; payment_methods: true; users: true };
}>;

export interface ExpenseView {
  id: bigint;
  category: { id: bigint; name: string };
  description: string;
  amount: Prisma.Decimal;
  expenseDate: Date;
  paymentMethod: { id: bigint; name: string };
  notes: string | null;
  status: string;
  createdByName: string;
  createdAt: Date;
}

export function toExpenseView(expense: ExpenseWithRelations): ExpenseView {
  return {
    id: expense.id,
    category: {
      id: expense.expense_categories.id,
      name: expense.expense_categories.name,
    },
    description: expense.description,
    amount: expense.amount,
    expenseDate: expense.expense_date,
    paymentMethod: {
      id: expense.payment_methods.id,
      name: expense.payment_methods.name,
    },
    notes: expense.notes,
    status: expense.status,
    createdByName: expense.users.full_name,
    createdAt: expense.created_at,
  };
}
