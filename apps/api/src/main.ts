import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import express from 'express';
import { join } from 'node:path';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { BigIntInterceptor } from './common/interceptors/bigint.interceptor';
import type { AppConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService<AppConfig, true>);

  app.use(cookieParser());

  const corsOrigin = configService.get('corsOrigin', { infer: true });
  if (corsOrigin) {
    app.enableCors({ origin: corsOrigin, credentials: true });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new BigIntInterceptor());

  const frontendPath = join(process.cwd(), 'apps/web/dist');

  // Servir archivos estáticos de React/PWA.
  app.use(express.static(frontendPath));

  // IMPORTANTE:
  // Inicializamos Nest primero para que registre todos sus endpoints
  // antes de agregar el fallback de React.
  await app.init();

  // Fallback para React Router.
  // Solo se ejecuta si ninguna ruta de NestJS respondió.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      return next();
    }

    if (
      req.path.startsWith('/auth') ||
      req.path.startsWith('/health') ||
      req.path.startsWith('/categories') ||
      req.path.startsWith('/sizes') ||
      req.path.startsWith('/colors') ||
      req.path.startsWith('/products') ||
      req.path.startsWith('/payment-methods') ||
      req.path.startsWith('/suppliers') ||
      req.path.startsWith('/purchases') ||
      req.path.startsWith('/inventory') ||
      req.path.startsWith('/sales') ||
      req.path.startsWith('/availability') ||
      req.path.startsWith('/finance') ||
      req.path.startsWith('/expenses') ||
      req.path.startsWith('/expense-categories') ||
      req.path.startsWith('/settings') ||
      req.path.startsWith('/users') ||
      req.path.startsWith('/reports') ||
      req.path.startsWith('/audit') ||
      req.path.startsWith('/consumables')
    ) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: 'Ruta no encontrada',
      });
    }

    return res.sendFile(join(frontendPath, 'index.html'));
  });

  const port = configService.get('port', { infer: true });

  await app.listen(port);

  Logger.log(
    `MALA MIA escuchando en http://localhost:${port}`,
    'Bootstrap',
  );
}

bootstrap().catch((error: unknown) => {
  Logger.error('Error al iniciar la aplicación', error, 'Bootstrap');
  process.exit(1);
});