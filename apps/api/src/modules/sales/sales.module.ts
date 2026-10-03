import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConsumablesModule } from '../consumables/consumables.module';
import { FinanceModule } from '../finance/finance.module';
import { InventoryModule } from '../inventory/inventory.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [AuthModule, InventoryModule, FinanceModule, ConsumablesModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
