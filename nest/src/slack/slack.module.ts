import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../projects/project.entity';
import { Tenant } from '../tenants/tenant.entity';
import { SlackService } from './slack.service';

@Module({
  imports: [TypeOrmModule.forFeature([Project, Tenant])],
  providers: [SlackService],
  exports: [SlackService],
})
export class SlackModule {}
