import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { CreateManualIncomeDto } from './dto/create-manual-income.dto';
import { QueryFinanceMovementsDto } from './dto/query-finance-movements.dto';
import { QueryFinanceSummaryDto } from './dto/query-finance-summary.dto';
import { UpdateDistributionSettingsDto } from './dto/update-distribution-settings.dto';
import { FinanceService } from './finance.service';

@UseGuards(SessionAuthGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('summary')
  getSummary(@Query() query: QueryFinanceSummaryDto) {
    return this.financeService.getSummary(query);
  }

  @Get('movements')
  listMovements(@Query() query: QueryFinanceMovementsDto) {
    return this.financeService.listMovements(query);
  }

  @Post('manual-income')
  @HttpCode(HttpStatus.CREATED)
  createManualIncome(
    @Body() dto: CreateManualIncomeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.financeService.createManualIncome(dto, BigInt(user.id));
  }

  @Get('distribution-settings')
  getDistributionSettings() {
    return this.financeService.getDistributionSettings();
  }

  @Patch('distribution-settings')
  updateDistributionSettings(
    @Body() dto: UpdateDistributionSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.financeService.updateDistributionSettings(dto, BigInt(user.id));
  }
}
