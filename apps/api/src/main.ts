import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
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

  const port = configService.get('port', { infer: true });
  await app.listen(port);

  Logger.log(
    `MALA MIA API escuchando en http://localhost:${port}`,
    'Bootstrap',
  );
}

bootstrap().catch((error: unknown) => {
  Logger.error('Error al iniciar la aplicación', error, 'Bootstrap');
  process.exit(1);
});
