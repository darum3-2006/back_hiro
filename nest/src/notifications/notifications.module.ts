import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembersModule } from '../members/members.module';
import { ProjectsModule } from '../projects/projects.module';
import { NotificationPreference } from './notification-preference.entity';
import { Notification } from './notification.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationPreference]),
    MembersModule,
    // 閲覧できないプロジェクトの通知を出さないため ProjectAccessService を使う
    ProjectsModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
