import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { ProjectsModule } from '../projects/projects.module';
import { TaskFlag } from '../tasks/task-flag.entity';
import { Flag } from './flag.entity';
import { FlagsController } from './flags.controller';
import { FlagsService } from './flags.service';
import { Tag } from './tag.entity';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';
import { TaskPriority } from './task-priority.entity';
import { TaskPrioritiesController } from './task-priorities.controller';
import { TaskPrioritiesService } from './task-priorities.service';
import { TaskStatus } from './task-status.entity';
import { TaskStatusesController } from './task-statuses.controller';
import { TaskStatusesService } from './task-statuses.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskStatus, TaskPriority, Tag, Flag, TaskFlag]),
    ProjectsModule,
    AuditModule,
  ],
  controllers: [TaskStatusesController, TaskPrioritiesController, TagsController, FlagsController],
  providers: [TaskStatusesService, TaskPrioritiesService, TagsService, FlagsService],
  exports: [TaskStatusesService, TaskPrioritiesService, TagsService, FlagsService, TypeOrmModule],
})
export class MastersModule {}
