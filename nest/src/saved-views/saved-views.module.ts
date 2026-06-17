import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembersModule } from '../members/members.module';
import { ProjectsModule } from '../projects/projects.module';
import { SavedViewLinksController } from './saved-view-links.controller';
import { SavedView } from './saved-view.entity';
import { SavedViewsController } from './saved-views.controller';
import { SavedViewsService } from './saved-views.service';

@Module({
  imports: [TypeOrmModule.forFeature([SavedView]), ProjectsModule, MembersModule],
  controllers: [SavedViewsController, SavedViewLinksController],
  providers: [SavedViewsService],
  exports: [SavedViewsService, TypeOrmModule],
})
export class SavedViewsModule {}
