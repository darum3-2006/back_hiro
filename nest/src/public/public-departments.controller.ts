import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { DepartmentsService } from '../departments/departments.service';
import { PublicDepartment, toPublicDepartment } from './dto/public-master';

/** 公開API: 部署マスタ（テナント単位・読み取り専用）。Task の requestingDeptCode 解決用。 */
@Controller('v1/departments')
@UseGuards(ApiKeyGuard)
export class PublicDepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<PublicDepartment[]> {
    const rows = await this.departments.listByTenant(user.tenantId);
    return rows.map(toPublicDepartment);
  }
}
