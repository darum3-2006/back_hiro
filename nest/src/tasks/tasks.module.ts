import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tag } from '../masters/tag.entity';
import { TaskStatus } from '../masters/task-status.entity';
import { ProjectsModule } from '../projects/projects.module';
import { MyTasksController } from './my-tasks.controller';
import { TaskLinksController } from './task-links.controller';
import { TaskTag } from './task-tag.entity';
import { Task } from './task.entity';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [TypeOrmModule.forFeature([Task, TaskTag, Tag, TaskStatus]), ProjectsModule],
  controllers: [TasksController, TaskLinksController, MyTasksController],
  providers: [TasksService],
  exports: [TasksService, TypeOrmModule],
})
export class TasksModule {}
