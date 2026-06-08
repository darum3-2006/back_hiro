import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { AuditLog } from './audit-log.entity';
import { AuditService } from './audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, User])],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
