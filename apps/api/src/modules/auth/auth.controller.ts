import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AppConfig } from '../../config/configuration';
import { toAuthenticatedUser } from '../users/user.mapper';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { SessionAuthGuard } from './session-auth.guard';
import {
  SESSION_COOKIE_MAX_AGE_MS,
  SESSION_COOKIE_NAME,
} from './session.constants';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  private cookieOptions(): CookieOptions {
    const isProduction =
      this.configService.get('env', { infer: true }) === 'production';
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthenticatedUser }> {
    const { token, user } = await this.authService.login(
      dto.username,
      dto.password,
      {
        userAgent: req.headers['user-agent'],
      },
    );

    res.cookie(SESSION_COOKIE_NAME, token, {
      ...this.cookieOptions(),
      maxAge: SESSION_COOKIE_MAX_AGE_MS,
    });

    return { user: toAuthenticatedUser(user) };
  }

  @UseGuards(SessionAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): { user: AuthenticatedUser } {
    return { user };
  }

  @UseGuards(SessionAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: true }> {
    const token = (req.cookies as Record<string, string> | undefined)?.[
      SESSION_COOKIE_NAME
    ];
    if (token) {
      await this.authService.logout(token);
    }
    res.clearCookie(SESSION_COOKIE_NAME, this.cookieOptions());
    return { success: true };
  }

  @UseGuards(SessionAuthGuard)
  @Patch('password')
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    await this.authService.changePassword(
      BigInt(user.id),
      dto.currentPassword,
      dto.newPassword,
    );
    return { success: true };
  }
}
