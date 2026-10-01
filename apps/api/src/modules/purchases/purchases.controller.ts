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
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { QueryPurchasesDto } from './dto/query-purchases.dto';
import { PurchaseView } from './purchases.mapper';
import { PaginatedPurchases, PurchasesService } from './purchases.service';

function parsePurchaseId(id: string): bigint {
  if (!/^\d+$/.test(id)) {
    throw new NotFoundException('Compra no encontrada.');
  }
  return BigInt(id);
}

@UseGuards(SessionAuthGuard)
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get()
  list(@Query() query: QueryPurchasesDto): Promise<PaginatedPurchases> {
    return this.purchasesService.list(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<PurchaseView> {
    return this.purchasesService.findOne(parsePurchaseId(id));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreatePurchaseDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PurchaseView> {
    return this.purchasesService.create(dto, BigInt(user.id));
  }
}
