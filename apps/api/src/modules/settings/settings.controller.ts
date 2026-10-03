import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { UpdateGeneralSettingsDto } from './dto/update-general-settings.dto';
import { SettingsService } from './settings.service';

@UseGuards(SessionAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('general')
  getGeneral() {
    return this.settingsService.getGeneralSettings();
  }

  @Patch('general')
  updateGeneral(
    @Body() dto: UpdateGeneralSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.updateGeneralSettings(dto, BigInt(user.id));
  }
}
