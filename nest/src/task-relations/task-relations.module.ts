import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsModule } from '../projects/projects.module';
import { Task } from '../tasks/task.entity';
import { ProjectRelationsController } from './project-relations.controller';
import { TaskRelation } from './task-relation.entity';
import { TaskRelationsController } from './task-relations.controller';
import { TaskRelationsService } from './task-relations.service';

@Module({
  imports: [TypeOrmModule.forFeature([TaskRelation, Task]), ProjectsModule],
  controllers: [TaskRelationsController, ProjectRelationsController],
  providers: [TaskRelationsService],
  exports: [TaskRelationsService],
})
export class TaskRelationsModule {}
