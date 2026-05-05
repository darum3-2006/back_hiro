import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { buildDatabaseOptions } from './config/database.config';
import { CommentsModule } from './comments/comments.module';
import { DepartmentsModule } from './departments/departments.module';
import { MastersModule } from './masters/masters.module';
import { MembersModule } from './members/members.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // 全体のレート制限（IP 単位）。auth/login 等で個別に override 可能。
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 20 }, // 20 req/sec
      { name: 'medium', ttl: 60_000, limit: 200 }, // 200 req/min
    ]),
    TypeOrmModule.forRootAsync({
      useFactory: () => buildDatabaseOptions(process.env),
    }),
    TenantsModule,
    UsersModule,
    AuthModule,
    ProjectsModule,
    DepartmentsModule,
    MembersModule,
    MastersModule,
    TasksModule,
    CommentsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
