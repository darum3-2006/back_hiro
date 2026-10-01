import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { jaExceptionFactory } from './common/validation/ja-exception-factory';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  // nginx の後ろで動かすため、X-Forwarded-For からクライアント IP を取る（IP 単位のレート制限用）。
  // 信頼するのはプライベートアドレスからの接続（nginx コンテナ等）だけにし、3101 番へ外から
  // 直接来たリクエストが X-Forwarded-For を偽装しても req.ip には反映されないようにする。
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');
  // リフレッシュトークン（httpOnly Cookie）の読み取りに使う
  app.use(cookieParser());
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
