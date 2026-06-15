import { Module } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { ProjectsModule } from '../projects/projects.module';
import { TasksModule } from '../tasks/tasks.module';
import { UsersModule } from '../users/users.module';
import { DocsController } from './docs.controller';
import { PublicProjectsController } from './public-projects.controller';
import { PublicTasksController } from './public-tasks.controller';

/**
 * 公開API（/api/v1/...）。APIキー認証（ApiKeyGuard）配下の read-only エンドポイント群。
 * データアクセスは既存の tenant-scoped な Service を再利用する。
 */
@Module({
  imports: [UsersModule, ProjectsModule, TasksModule],
  controllers: [DocsController, PublicProjectsController, PublicTasksController],
  providers: [ApiKeyGuard],
})
export class PublicModule {}
