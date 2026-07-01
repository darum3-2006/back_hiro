import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { TaskStatus } from '../masters/task-status.entity';
import { ProjectMember } from '../members/member.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProjectsModule } from '../projects/projects.module';
import { SlackModule } from '../slack/slack.module';
import { Task } from '../tasks/task.entity';
import { ProjectSubtasksController } from './project-subtasks.controller';
import { Subtask } from './subtask.entity';
import { SubtasksController } from './subtasks.controller';
import { SubtasksService } from './subtasks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subtask, Task, ProjectMember, TaskStatus]),
    ProjectsModule,
    AuditModule,
    SlackModule,
    NotificationsModule,
  ],
  controllers: [SubtasksController, ProjectSubtasksController],
  providers: [SubtasksService],
  exports: [SubtasksService],
})
export class SubtasksModule {}
