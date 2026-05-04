import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

export const buildDatabaseOptions = (env: NodeJS.ProcessEnv): TypeOrmModuleOptions => ({
  type: 'mysql',
  host: env.DATABASE_HOST,
  port: parseInt(env.DATABASE_PORT ?? '3306', 10),
  username: env.DATABASE_USERNAME,
  password: env.DATABASE_PASSWORD,
  database: env.DATABASE_NAME,
  autoLoadEntities: true,
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: false,
  logging: env.NODE_ENV !== 'production' ? ['error', 'warn'] : ['error'],
});
