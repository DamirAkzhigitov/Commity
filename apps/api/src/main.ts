import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Railway / many PaaS hosts inject $PORT; respect it before falling back
  // to the explicit API_PORT used in local dev.
  const port =
    config.get<number>('PORT') ?? config.get<number>('API_PORT') ?? 3000;
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
