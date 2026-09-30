import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import type { AppConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService<AppConfig, true>);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

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
