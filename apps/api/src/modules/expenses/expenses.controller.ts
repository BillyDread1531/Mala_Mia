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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { QueryExpensesDto } from './dto/query-expenses.dto';
import { VoidExpenseDto } from './dto/void-expense.dto';
import { ExpensesService, PaginatedExpenses } from './expenses.service';
import { ExpenseView } from './expenses.mapper';

function parseExpenseId(id: string): bigint {
  if (!/^\d+$/.test(id)) {
    throw new NotFoundException('Gasto no encontrado.');
  }
  return BigInt(id);
}

@UseGuards(SessionAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  list(@Query() query: QueryExpensesDto): Promise<PaginatedExpenses> {
    return this.expensesService.list(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ExpenseView> {
    return this.expensesService.findOne(parseExpenseId(id));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateExpenseDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ExpenseView> {
    return this.expensesService.create(dto, BigInt(user.id));
  }

  @Patch(':id/void')
  void(
    @Param('id') id: string,
    @Body() dto: VoidExpenseDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ExpenseView> {
    return this.expensesService.void(parseExpenseId(id), dto, BigInt(user.id));
  }
}
