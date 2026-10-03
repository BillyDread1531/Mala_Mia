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
  Query,
  UseGuards,
} from '@nestjs/common';
import { SetActiveDto } from '../catalog/dto/set-active.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { QuerySuppliersDto } from './dto/query-suppliers.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SuppliersService } from './suppliers.service';

function parseSupplierId(id: string): bigint {
  if (!/^\d+$/.test(id)) {
    throw new NotFoundException('Proveedor no encontrado.');
  }
  return BigInt(id);
}

@UseGuards(SessionAuthGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  list(@Query() query: QuerySuppliersDto) {
    return this.suppliersService.list(query.search);
  }

  @Get('all')
  listAll() {
    return this.suppliersService.listAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(parseSupplierId(id));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.suppliersService.update(
      parseSupplierId(id),
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
    return this.suppliersService.setActive(
      parseSupplierId(id),
      dto.isActive,
      BigInt(user.id),
    );
  }
}
