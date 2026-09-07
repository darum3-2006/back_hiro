import { Module } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { DepartmentsModule } from '../departments/departments.module';
import { MastersModule } from '../masters/masters.module';
import { MembersModule } from '../members/members.module';
import { ProjectsModule } from '../projects/projects.module';
import { TasksModule } from '../tasks/tasks.module';
import { UsersModule } from '../users/users.module';
import { DocsController } from './docs.controller';
import { PublicDepartmentsController } from './public-departments.controller';
import { PublicMastersController } from './public-masters.controller';
import { PublicProjectsController } from './public-projects.controller';
import { PublicTaskLookupController } from './public-task-lookup.controller';
import { PublicTasksController } from './public-tasks.controller';

/**
 * 公開API（/api/v1/...）。APIキー認証（ApiKeyGuard）配下の read-only エンドポイント群。
 * データアクセスは既存の tenant-scoped な Service を再利用する。
 */
@Module({
  imports: [
    UsersModule,
    ProjectsModule,
    TasksModule,
    MastersModule,
    MembersModule,
    DepartmentsModule,
  ],
  controllers: [
    DocsController,
    PublicProjectsController,
    PublicTasksController,
    PublicTaskLookupController,
    PublicMastersController,
    PublicDepartmentsController,
  ],
  providers: [ApiKeyGuard],
})
export class PublicModule {}
