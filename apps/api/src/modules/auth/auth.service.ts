import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { UsersService, UserWithRole } from '../users/users.service';
import { CreateSessionMeta, SessionService } from './session.service';

const INVALID_CREDENTIALS_MESSAGE = 'Usuario o contraseña incorrectos.';

@Injectable()
export class AuthService {
  /** Hash "señuelo" para que rechazar un username inexistente tarde lo
   * mismo que rechazar una contraseña incorrecta (evita enumerar
   * usuarios por tiempo de respuesta). Se calcula una sola vez. */
  private dummyHashPromise: Promise<string> | null = null;

  constructor(
    private readonly usersService: UsersService,
    private readonly sessionService: SessionService,
  ) {}

  private getDummyHash(): Promise<string> {
    if (!this.dummyHashPromise) {
      this.dummyHashPromise = argon2.hash(randomBytes(16).toString('hex'), {
        type: argon2.argon2id,
      });
    }
    return this.dummyHashPromise;
  }

  private async verifyCredentials(
    username: string,
    password: string,
  ): Promise<UserWithRole | null> {
    const user = await this.usersService.findByUsername(username);

    if (!user || !user.is_active || !user.password_hash) {
      await argon2
        .verify(await this.getDummyHash(), password)
        .catch(() => false);
      return null;
    }

    const isValid = await argon2.verify(user.password_hash, password);
    return isValid ? user : null;
  }

  async login(
    username: string,
    password: string,
    meta: CreateSessionMeta,
  ): Promise<{ token: string; user: UserWithRole }> {
    const user = await this.verifyCredentials(username, password);

    if (!user) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const token = await this.sessionService.createSession(user.id, meta);
    return { token, user };
  }

  async logout(token: string): Promise<void> {
    await this.sessionService.revokeSession(token);
  }
}
