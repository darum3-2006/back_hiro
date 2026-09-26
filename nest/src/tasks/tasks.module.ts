import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { Comment } from '../comments/comment.entity';
import { Department } from '../departments/department.entity';
import { ProjectMember } from '../members/member.entity';
import { Flag } from '../masters/flag.entity';
import { Tag } from '../masters/tag.entity';
import { TaskPriority } from '../masters/task-priority.entity';
import { TaskStatus } from '../masters/task-status.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProjectsModule } from '../projects/projects.module';
import { SlackModule } from '../slack/slack.module';
import { Subtask } from '../subtasks/subtask.entity';
import { UsersModule } from '../users/users.module';
import { DashboardController } from './dashboard.controller';
import { MyTasksController } from './my-tasks.controller';
import { SearchController } from './search.controller';
import { TaskFlag } from './task-flag.entity';
import { TaskLinksController } from './task-links.controller';
import { TaskTag } from './task-tag.entity';
import { Task } from './task.entity';
import { TasksController } from './tasks.controller';
import { MyTaskViewsController, TaskViewRecordController } from './task-views.controller';
import { TaskViewsService } from './task-views.service';
import { TaskView } from './task-view.entity';
import { TaskMoveController } from './task-move.controller';
import { TaskMoveService } from './task-move.service';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Task,
      TaskTag,
      TaskFlag,
      Tag,
      Flag,
      TaskStatus,
      TaskPriority,
      ProjectMember,
      Department,
      Comment,
      Subtask,
      TaskView,
    ]),
    ProjectsModule,
    AuditModule,
    NotificationsModule,
    SlackModule,
    UsersModule,
  ],
  controllers: [
    TasksController,
    TaskLinksController,
    MyTasksController,
    SearchController,
    DashboardController,
    TaskViewRecordController,
    MyTaskViewsController,
    TaskMoveController,
  ],
  providers: [TasksService, TaskViewsService, TaskMoveService],
  exports: [TasksService, TypeOrmModule],
})
export class TasksModule {}
