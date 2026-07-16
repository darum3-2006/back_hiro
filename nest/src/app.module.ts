import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { ReadonlyWriteBlockInterceptor } from './auth/readonly-write-block.interceptor';
import { buildDatabaseOptions } from './config/database.config';
import { CommentsModule } from './comments/comments.module';
import { DepartmentsModule } from './departments/departments.module';
import { MastersModule } from './masters/masters.module';
import { MembersModule } from './members/members.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ProjectsModule } from './projects/projects.module';
import { PublicModule } from './public/public.module';
import { SavedViewsModule } from './saved-views/saved-views.module';
import { SubtasksModule } from './subtasks/subtasks.module';
import { TaskRelationsModule } from './task-relations/task-relations.module';
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
    AuditModule,
    ProjectsModule,
    DepartmentsModule,
    MembersModule,
    MastersModule,
    NotificationsModule,
    TasksModule,
    CommentsModule,
    PublicModule,
    SavedViewsModule,
    SubtasksModule,
    TaskRelationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // readonly（閲覧のみ）ユーザーの書き込み系リクエストを一括拒否
    {
      provide: APP_INTERCEPTOR,
      useClass: ReadonlyWriteBlockInterceptor,
    },
  ],
})
export class AppModule {}
