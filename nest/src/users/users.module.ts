import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsModule } from '../projects/projects.module';
import { ApiKeysController } from './api-keys.controller';
import { User } from './user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  // 閲覧できるプロジェクトの設定（ProjectAccessService）をユーザー管理から扱う
  imports: [TypeOrmModule.forFeature([User]), ProjectsModule],
  controllers: [UsersController, ApiKeysController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
