import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectMember } from '../members/member.entity';
import { SlackModule } from '../slack/slack.module';
import { ProjectAccessService } from './project-access.service';
import { Project } from './project.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { UserProjectAccess } from './user-project-access.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Project, ProjectMember, UserProjectAccess]), SlackModule],
  controllers: [ProjectsController],
  // ProjectAccessService は ProjectAccessGuard の依存。プロジェクト配下の各モジュールは
  // 既にこのモジュールを import しているため、Guard を付けるだけで解決できる。
  providers: [ProjectsService, ProjectAccessService],
  exports: [ProjectsService, ProjectAccessService, TypeOrmModule],
})
export class ProjectsModule {}
