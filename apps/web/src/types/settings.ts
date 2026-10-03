export interface GeneralSettings {
  businessName: string;
  receiptMessage: string;
  targetProfitMargin: number;
  lowStockThreshold: number;
  defaultShippingFee: number;
}

export type UpdateGeneralSettingsInput = Partial<GeneralSettings>;
