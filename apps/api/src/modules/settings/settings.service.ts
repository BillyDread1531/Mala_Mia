import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AUDIT_ACTIONS, AuditService } from '../audit/audit.service';
import { UpdateGeneralSettingsDto } from './dto/update-general-settings.dto';

const KEYS = {
  businessName: 'business_name',
  receiptMessage: 'default_receipt_message',
  targetProfitMargin: 'target_profit_margin',
  lowStockThreshold: 'low_stock_threshold',
  defaultShippingFee: 'default_shipping_fee',
} as const;

const DEFAULTS: Record<(typeof KEYS)[keyof typeof KEYS], string> = {
  business_name: 'MALA MÍA',
  default_receipt_message: 'Gracias por tu compra. 💗',
  target_profit_margin: '35',
  low_stock_threshold: '2',
  default_shipping_fee: '35',
};

export interface GeneralSettings {
  businessName: string;
  receiptMessage: string;
  targetProfitMargin: number;
  lowStockThreshold: number;
  defaultShippingFee: number;
}

/**
 * Capa de Configuración sobre `app_settings`, la misma tabla genérica
 * clave/valor que Productos (margen) e Inventario (stock bajo) ya leen
 * directamente. No se duplica el dato: esto solo agrega la posibilidad de
 * ESCRIBIRLO desde una pantalla, además de leerlo; los servicios existentes
 * (`ProductsService.getMarginPercent`, `InventoryService.getLowStockThreshold`)
 * siguen leyendo la misma fila sin ningún cambio.
 */
@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private async getValue(key: string): Promise<string> {
    const row = await this.prisma.app_settings.findUnique({
      where: { setting_key: key },
    });
    return row?.setting_value ?? DEFAULTS[key as keyof typeof DEFAULTS];
  }

  private async setValue(
    key: string,
    value: string,
    group: string,
    description: string,
    userId: bigint,
  ): Promise<void> {
    await this.prisma.app_settings.upsert({
      where: { setting_key: key },
      update: { setting_value: value, updated_by: userId },
      create: {
        setting_key: key,
        setting_value: value,
        setting_group: group,
        description,
        updated_by: userId,
      },
    });
  }

  async getGeneralSettings(): Promise<GeneralSettings> {
    const [businessName, receiptMessage, margin, threshold, shippingFee] =
      await Promise.all([
        this.getValue(KEYS.businessName),
        this.getValue(KEYS.receiptMessage),
        this.getValue(KEYS.targetProfitMargin),
        this.getValue(KEYS.lowStockThreshold),
        this.getValue(KEYS.defaultShippingFee),
      ]);
    return {
      businessName,
      receiptMessage,
      targetProfitMargin: Number(margin),
      lowStockThreshold: Number(threshold),
      defaultShippingFee: Number(shippingFee),
    };
  }

  async updateGeneralSettings(
    dto: UpdateGeneralSettingsDto,
    userId: bigint,
  ): Promise<GeneralSettings> {
    if (dto.businessName !== undefined) {
      await this.setValue(
        KEYS.businessName,
        dto.businessName.trim(),
        'BUSINESS',
        'Nombre del negocio mostrado en la aplicación',
        userId,
      );
    }
    if (dto.receiptMessage !== undefined) {
      await this.setValue(
        KEYS.receiptMessage,
        dto.receiptMessage.trim(),
        'RECEIPTS',
        'Mensaje mostrado en los comprobantes',
        userId,
      );
    }
    if (dto.targetProfitMargin !== undefined) {
      await this.setValue(
        KEYS.targetProfitMargin,
        String(dto.targetProfitMargin),
        'PRICING',
        'Margen objetivo utilizado para calcular precios recomendados',
        userId,
      );
    }
    if (dto.lowStockThreshold !== undefined) {
      await this.setValue(
        KEYS.lowStockThreshold,
        String(dto.lowStockThreshold),
        'INVENTORY',
        'Cantidad máxima considerada como stock bajo',
        userId,
      );
    }
    if (dto.defaultShippingFee !== undefined) {
      await this.setValue(
        KEYS.defaultShippingFee,
        String(dto.defaultShippingFee),
        'SALES',
        'Monto de envío sugerido al vender, editable por venta',
        userId,
      );
    }
    await this.auditService.record(this.prisma, {
      userId,
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      entityType: 'settings',
      description: 'Configuración del negocio actualizada.',
      newValues: { ...dto },
    });
    return this.getGeneralSettings();
  }
}
