import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { SetActiveDto } from '../catalog/dto/set-active.dto';
import { AdjustConsumableDto } from './dto/adjust-consumable.dto';
import { CreateConsumableDto } from './dto/create-consumable.dto';
import { UpdateConsumableDto } from './dto/update-consumable.dto';
import { ConsumablesService } from './consumables.service';

function parseConsumableId(id: string): bigint {
  if (!/^\d+$/.test(id)) {
    throw new NotFoundException('Insumo no encontrado.');
  }
  return BigInt(id);
}

@UseGuards(SessionAuthGuard)
@Controller('consumables')
export class ConsumablesController {
  constructor(private readonly consumablesService: ConsumablesService) {}

  @Get()
  list() {
    return this.consumablesService.list();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateConsumableDto, @CurrentUser() user: AuthenticatedUser) {
    return this.consumablesService.create(dto, BigInt(user.id));
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateConsumableDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.consumablesService.update(
      parseConsumableId(id),
      dto,
      BigInt(user.id),
    );
  }

  @Patch(':id/active')
  setActive(
    @Param('id') id: string,
    @Body() dto: SetActiveDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.consumablesService.setActive(
      parseConsumableId(id),
      dto.isActive,
      BigInt(user.id),
    );
  }

  @Patch(':id/adjust')
  adjust(
    @Param('id') id: string,
    @Body() dto: AdjustConsumableDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.consumablesService.adjust(
      parseConsumableId(id),
      dto,
      BigInt(user.id),
    );
  }
}
