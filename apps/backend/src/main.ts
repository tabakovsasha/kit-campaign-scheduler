import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BigIntSerializerInterceptor } from './common/bigint-serializer.interceptor';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { IsoConsoleLogger } from './common/iso-console.logger';
import { RequestIdMiddleware } from './common/request-id.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new IsoConsoleLogger(),
  });

  app.setGlobalPrefix('api');
  app.use(new RequestIdMiddleware().use);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new BigIntSerializerInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });

  const port = Number(process.env.PORT ?? '4000');
  await app.listen(port);
}

bootstrap();
