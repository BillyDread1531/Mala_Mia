import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { UserWithRole } from '../users/users.service';

export interface CreateSessionMeta {
  userAgent?: string;
  deviceName?: string;
}

export interface ActiveSession {
  id: bigint;
  user: UserWithRole;
}

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Crea una sesión persistente (expires_at = null): no expira por
   * inactividad, solo por logout/revocación/cambio de contraseña
   * (CONTEXT.md #18). Devuelve el token en texto plano para la cookie;
   * en la base solo se guarda su hash.
   */
  async createSession(
    userId: bigint,
    meta: CreateSessionMeta,
  ): Promise<string> {
    const token = randomBytes(32).toString('hex');

    await this.prisma.user_sessions.create({
      data: {
        user_id: userId,
        session_token_hash: this.hashToken(token),
        user_agent: meta.userAgent?.slice(0, 500),
        device_name: meta.deviceName?.slice(0, 150),
        expires_at: null,
      },
    });

    return token;
  }

  async validateSession(token: string): Promise<ActiveSession | null> {
    const session = await this.prisma.user_sessions.findUnique({
      where: { session_token_hash: this.hashToken(token) },
      include: { users: { include: { roles: true } } },
    });

    if (!session || session.revoked_at) {
      return null;
    }
    if (session.expires_at && session.expires_at.getTime() < Date.now()) {
      return null;
    }
    if (!session.users.is_active) {
      return null;
    }

    await this.prisma.user_sessions.update({
      where: { id: session.id },
      data: { last_activity_at: new Date() },
    });

    return { id: session.id, user: session.users };
  }

  async revokeSession(token: string): Promise<void> {
    await this.prisma.user_sessions.updateMany({
      where: { session_token_hash: this.hashToken(token), revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  async revokeAllForUser(userId: bigint): Promise<void> {
    await this.prisma.user_sessions.updateMany({
      where: { user_id: userId, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }
}
