import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AUDIT_ACTIONS, AuditService } from '../audit/audit.service';

export type UserWithRole = Prisma.usersGetPayload<{ include: { roles: true } }>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findByUsername(username: string): Promise<UserWithRole | null> {
    return this.prisma.users.findUnique({
      where: { username },
      include: { roles: true },
    });
  }

  findById(id: bigint): Promise<UserWithRole | null> {
    return this.prisma.users.findUnique({
      where: { id },
      include: { roles: true },
    });
  }

  list(): Promise<UserWithRole[]> {
    return this.prisma.users.findMany({
      include: { roles: true },
      orderBy: { full_name: 'asc' },
    });
  }

  /** Nunca permite que una cuenta se desactive a sí misma: con solo dos
   * administradores, es la única forma de garantizar que siempre quede al
   * menos una sesión capaz de revertir el cambio. */
  async setActive(
    id: bigint,
    isActive: boolean,
    currentUserId: bigint,
  ): Promise<UserWithRole> {
    const user = await this.prisma.users.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    if (id === currentUserId && !isActive) {
      throw new BadRequestException('No puedes desactivar tu propia cuenta.');
    }
    const updated = await this.prisma.users.update({
      where: { id },
      data: { is_active: isActive },
      include: { roles: true },
    });
    await this.auditService.record(this.prisma, {
      userId: currentUserId,
      action: AUDIT_ACTIONS.USER_ACTIVE_CHANGED,
      entityType: 'user',
      entityId: id,
      description: `Usuario ${updated.full_name} ${isActive ? 'reactivado' : 'desactivado'}.`,
      oldValues: { isActive: !isActive },
      newValues: { isActive },
    });
    return updated;
  }
}
