import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { jaExceptionFactory } from './common/validation/ja-exception-factory';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  // 動的な JSON API に条件付きキャッシュ（ETag → 304）は不要かつ有害。
  // 304 は空ボディで返るため、経路（プロキシ等）によってはクライアントが
  // 空レスポンスを受けて画面側の解決処理が壊れる。API は常にフルボディで返す。
  app.set('etag', false);
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
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
