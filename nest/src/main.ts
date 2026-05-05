import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { jaExceptionFactory } from './common/validation/ja-exception-factory';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: jaExceptionFactory,
    }),
  );
  await app.listen(process.env.PORT ?? 3101, '0.0.0.0');
}
void bootstrap();
