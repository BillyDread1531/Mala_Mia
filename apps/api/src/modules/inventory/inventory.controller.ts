import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { AdjustVariantDto } from './dto/adjust-variant.dto';
import { QueryGroupedInventoryDto } from './dto/query-grouped-inventory.dto';
import { QueryInventoryDto } from './dto/query-inventory.dto';
import { QueryMovementsDto } from './dto/query-movements.dto';
import { InventoryService } from './inventory.service';

function parseId(id: string): bigint {
  if (!/^\d+$/.test(id)) {
    throw new NotFoundException('Inventario no encontrado.');
  }
  return BigInt(id);
}

@UseGuards(SessionAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  list(@Query() query: QueryInventoryDto) {
    return this.inventoryService.list(query);
  }

  @Get('grouped')
  listGrouped(@Query() query: QueryGroupedInventoryDto) {
    return this.inventoryService.listGroupedByProduct(query);
  }

  @Get('movements')
  listMovements(@Query() query: QueryMovementsDto) {
    return this.inventoryService.listMovements(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.inventoryService.findOne(parseId(id));
  }

  @Patch(':id/adjust')
  adjust(
    @Param('id') id: string,
    @Body() dto: AdjustInventoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.adjust(parseId(id), dto, BigInt(user.id));
  }

  @Post('adjust-variant')
  adjustByVariant(
    @Body() dto: AdjustVariantDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.adjustByVariant(dto, BigInt(user.id));
  }
}
