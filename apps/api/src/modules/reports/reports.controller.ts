import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { QueryInventoryReportDto } from './dto/query-inventory-report.dto';
import { QueryPurchasesReportDto } from './dto/query-purchases-report.dto';
import { QuerySalesReportDto } from './dto/query-sales-report.dto';
import { ReportsService } from './reports.service';

@UseGuards(SessionAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales')
  getSales(@Query() query: QuerySalesReportDto) {
    return this.reportsService.getSalesReport(query);
  }

  @Get('purchases')
  getPurchases(@Query() query: QueryPurchasesReportDto) {
    return this.reportsService.getPurchasesReport(query);
  }

  @Get('inventory')
  getInventory(@Query() query: QueryInventoryReportDto) {
    return this.reportsService.getInventoryReport(query);
  }
}
