import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

dotenv.config();

/**
 * TypeORM CLI（migration:generate / migration:run など）が読み込む DataSource。
 * NestJS の TypeOrmModule とは別経路だが、接続情報は同じ .env を共有。
 *
 * ts-node 経由（開発時）と node 経由（本番、dist/data-source.js）の両方で
 * 動作するよう、entities / migrations のパスを実行コンテキストで切り替える。
 */
const isCompiled = __filename.endsWith('.js');
const baseDir = isCompiled ? 'dist' : 'src';
const ext = isCompiled ? 'js' : 'ts';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT ?? '3306', 10),
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: [`${baseDir}/**/*.entity.${ext}`],
  migrations: [`${baseDir}/migrations/*.${ext}`],
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: false,
});
