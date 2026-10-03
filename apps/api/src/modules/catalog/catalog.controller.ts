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
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { CatalogService } from './catalog.service';
import { CreateNamedEntityDto } from './dto/create-named-entity.dto';
import { SetActiveDto } from './dto/set-active.dto';

function parseId(id: string): bigint {
  if (!/^\d+$/.test(id)) {
    throw new NotFoundException('No encontrado.');
  }
  return BigInt(id);
}

@UseGuards(SessionAuthGuard)
@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('categories')
  categories() {
    return this.catalogService.listCategories();
  }

  @Get('categories/all')
  allCategories() {
    return this.catalogService.listAllCategories();
  }

  @Post('categories')
  createCategory(@Body() dto: CreateNamedEntityDto) {
    return this.catalogService.createCategory(dto.name);
  }

  @Patch('categories/:id')
  setCategoryActive(@Param('id') id: string, @Body() dto: SetActiveDto) {
    return this.catalogService.setCategoryActive(parseId(id), dto.isActive);
  }

  @Get('sizes')
  sizes() {
    return this.catalogService.listSizes();
  }

  @Get('sizes/all')
  allSizes() {
    return this.catalogService.listAllSizes();
  }

  @Post('sizes')
  createSize(@Body() dto: CreateNamedEntityDto) {
    return this.catalogService.createSize(dto.name);
  }

  @Patch('sizes/:id')
  setSizeActive(@Param('id') id: string, @Body() dto: SetActiveDto) {
    return this.catalogService.setSizeActive(parseId(id), dto.isActive);
  }

  @Get('colors')
  colors() {
    return this.catalogService.listColors();
  }

  @Get('colors/all')
  allColors() {
    return this.catalogService.listAllColors();
  }

  @Post('colors')
  createColor(@Body() dto: CreateNamedEntityDto) {
    return this.catalogService.createColor(dto.name);
  }

  @Patch('colors/:id')
  setColorActive(@Param('id') id: string, @Body() dto: SetActiveDto) {
    return this.catalogService.setColorActive(parseId(id), dto.isActive);
  }

  @Get('payment-methods')
  paymentMethods(@Query('context') context?: string) {
    return this.catalogService.listPaymentMethods(
      context === 'sales'
        ? 'sales'
        : context === 'expenses'
          ? 'expenses'
          : 'purchases',
    );
  }

  @Get('payment-methods/all')
  allPaymentMethods() {
    return this.catalogService.listAllPaymentMethods();
  }

  @Patch('payment-methods/:id')
  setPaymentMethodActive(@Param('id') id: string, @Body() dto: SetActiveDto) {
    return this.catalogService.setPaymentMethodActive(
      parseId(id),
      dto.isActive,
    );
  }

  @Get('expense-categories')
  expenseCategories() {
    return this.catalogService.listExpenseCategories();
  }

  @Get('expense-categories/all')
  allExpenseCategories() {
    return this.catalogService.listAllExpenseCategories();
  }

  @Post('expense-categories')
  createExpenseCategory(@Body() dto: CreateNamedEntityDto) {
    return this.catalogService.createExpenseCategory(dto.name);
  }

  @Patch('expense-categories/:id')
  setExpenseCategoryActive(@Param('id') id: string, @Body() dto: SetActiveDto) {
    return this.catalogService.setExpenseCategoryActive(
      parseId(id),
      dto.isActive,
    );
  }
}
