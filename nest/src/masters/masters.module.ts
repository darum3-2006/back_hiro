import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsModule } from '../projects/projects.module';
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
  imports: [TypeOrmModule.forFeature([TaskStatus, TaskPriority, Tag]), ProjectsModule],
  controllers: [TaskStatusesController, TaskPrioritiesController, TagsController],
  providers: [TaskStatusesService, TaskPrioritiesService, TagsService],
  exports: [TaskStatusesService, TaskPrioritiesService, TagsService, TypeOrmModule],
})
export class MastersModule {}
