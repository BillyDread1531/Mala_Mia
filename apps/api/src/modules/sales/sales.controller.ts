import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { CancelSaleDto } from './dto/cancel-sale.dto';
import { CreateCorrectionDto } from './dto/create-correction.dto';
import { CreateExchangeDto } from './dto/create-exchange.dto';
import { CreateReturnDto } from './dto/create-return.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { QuerySalesDto } from './dto/query-sales.dto';
import { SaleHistoryEntry, SaleView } from './sales.mapper';
import { PaginatedSales, SalesService } from './sales.service';

function parseSaleId(id: string): bigint {
  if (!/^\d+$/.test(id)) {
    throw new NotFoundException('Venta no encontrada.');
  }
  return BigInt(id);
}

@UseGuards(SessionAuthGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  list(@Query() query: QuerySalesDto): Promise<PaginatedSales> {
    return this.salesService.list(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<SaleView> {
    return this.salesService.findOne(parseSaleId(id));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateSaleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SaleView> {
    return this.salesService.create(dto, BigInt(user.id));
  }

  @Get(':id/history')
  history(@Param('id') id: string): Promise<SaleHistoryEntry[]> {
    return this.salesService.getHistory(parseSaleId(id));
  }

  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelSaleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SaleView> {
    return this.salesService.cancel(parseSaleId(id), dto, BigInt(user.id));
  }

  @Post(':id/returns')
  @HttpCode(HttpStatus.CREATED)
  createReturn(
    @Param('id') id: string,
    @Body() dto: CreateReturnDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SaleView> {
    return this.salesService.createReturn(
      parseSaleId(id),
      dto,
      BigInt(user.id),
    );
  }

  @Post(':id/exchanges')
  @HttpCode(HttpStatus.CREATED)
  createExchange(
    @Param('id') id: string,
    @Body() dto: CreateExchangeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SaleView> {
    return this.salesService.createExchange(
      parseSaleId(id),
      dto,
      BigInt(user.id),
    );
  }

  @Post(':id/corrections')
  @HttpCode(HttpStatus.CREATED)
  createCorrection(
    @Param('id') id: string,
    @Body() dto: CreateCorrectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SaleView> {
    return this.salesService.createCorrection(
      parseSaleId(id),
      dto,
      BigInt(user.id),
    );
  }
}
