import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AvailabilityModule } from '../availability/availability.module';
import { ConsumablesModule } from '../consumables/consumables.module';
import { FinanceModule } from '../finance/finance.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [AuthModule, FinanceModule, AvailabilityModule, ConsumablesModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
