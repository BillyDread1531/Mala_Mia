import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { toAuthenticatedUser } from '../users/user.mapper';
import { SESSION_COOKIE_NAME } from './session.constants';
import { SessionService } from './session.service';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = (request.cookies as Record<string, string> | undefined)?.[
      SESSION_COOKIE_NAME
    ];

    if (!token) {
      throw new UnauthorizedException('No autenticado.');
    }

    const session = await this.sessionService.validateSession(token);
    if (!session) {
      throw new UnauthorizedException('Sesión inválida o expirada.');
    }

    request.authUser = toAuthenticatedUser(session.user);
    return true;
  }
}
