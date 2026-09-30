import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

interface SeedUser {
  username: string;
  fullName: string;
  roleName: string;
  /** Nombre de la variable de entorno que trae la contraseña real.
   *  Nunca se hardcodea aquí ni se commitea en texto plano. */
  passwordEnvVar: string;
}

const SEED_USERS: SeedUser[] = [
  { username: 'andrea', fullName: 'Andrea', roleName: 'ADMIN', passwordEnvVar: 'SEED_PASSWORD_ANDREA' },
  { username: 'billy', fullName: 'Billy', roleName: 'ADMIN', passwordEnvVar: 'SEED_PASSWORD_BILLY' },
];

async function main(): Promise<void> {
  for (const seedUser of SEED_USERS) {
    const password = process.env[seedUser.passwordEnvVar];

    if (!password) {
      console.log(`Omitido: "${seedUser.username}" (variable ${seedUser.passwordEnvVar} no definida en .env)`);
      continue;
    }

    const role = await prisma.roles.findUniqueOrThrow({ where: { name: seedUser.roleName } });
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    await prisma.users.upsert({
      where: { username: seedUser.username },
      update: {
        password_hash: passwordHash,
        full_name: seedUser.fullName,
        role_id: role.id,
        is_active: true,
      },
      create: {
        username: seedUser.username,
        full_name: seedUser.fullName,
        role_id: role.id,
        password_hash: passwordHash,
        is_active: true,
      },
    });

    console.log(`OK: usuario "${seedUser.username}" (rol ${seedUser.roleName}) creado/actualizado.`);
  }
}

main()
  .catch((error: unknown) => {
    console.error('Fallo el seed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
