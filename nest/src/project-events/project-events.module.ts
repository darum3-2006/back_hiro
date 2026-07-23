import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ProjectsModule } from '../projects/projects.module';
import { ProjectEventsController } from './project-events.controller';
import { ProjectEventsInterceptor } from './project-events.interceptor';
import { ProjectEventsService } from './project-events.service';

@Module({
  imports: [ProjectsModule],
  controllers: [ProjectEventsController],
  providers: [
    ProjectEventsService,
    // 書き込み系リクエスト成功後のイベント発火（全コントローラ横断）
    { provide: APP_INTERCEPTOR, useClass: ProjectEventsInterceptor },
  ],
  exports: [ProjectEventsService],
})
export class ProjectEventsModule {}
