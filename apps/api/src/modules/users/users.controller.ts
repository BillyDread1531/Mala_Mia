import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { SetUserActiveDto } from './dto/set-user-active.dto';
import { toUserView, UserView } from './user.mapper';
import { UsersService } from './users.service';

function parseUserId(id: string): bigint {
  if (!/^\d+$/.test(id)) {
    throw new NotFoundException('Usuario no encontrado.');
  }
  return BigInt(id);
}

@UseGuards(SessionAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async list(): Promise<UserView[]> {
    const users = await this.usersService.list();
    return users.map(toUserView);
  }

  @Patch(':id')
  async setActive(
    @Param('id') id: string,
    @Body() dto: SetUserActiveDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserView> {
    const updated = await this.usersService.setActive(
      parseUserId(id),
      dto.isActive,
      BigInt(user.id),
    );
    return toUserView(updated);
  }
}
