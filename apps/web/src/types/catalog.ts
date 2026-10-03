export interface Category {
  id: string;
  name: string;
  isActive: boolean;
}

export interface Size {
  id: string;
  name: string;
  normalizedName: string;
  isActive: boolean;
}

export interface Color {
  id: string;
  name: string;
  normalizedName: string;
  isActive: boolean;
}

export interface PaymentMethod {
  id: string;
  name: string;
  appliesToSales: boolean;
  appliesToPurchases: boolean;
  appliesToExpenses: boolean;
  isActive: boolean;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  isActive: boolean;
}
