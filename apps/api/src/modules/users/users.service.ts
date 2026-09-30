import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type UserWithRole = Prisma.usersGetPayload<{ include: { roles: true } }>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
}
