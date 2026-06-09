import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Controller('departments')
@UseGuards(JwtAuthGuard)
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  // 一覧はタスクのフォーム等でも使うため全認証ユーザーに開放。
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.departments.listByTenant(user.tenantId);
  }

  // 追加・編集・削除はテナント管理者のみ。
  @Post()
  @UseGuards(AdminGuard)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDepartmentDto) {
    return this.departments.create(user.tenantId, dto);
  }

  @Patch(':code')
  @UseGuards(AdminGuard)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('code') code: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departments.update(user.tenantId, code, dto);
  }

  @Delete(':code')
  @UseGuards(AdminGuard)
  @HttpCode(204)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('code') code: string) {
    return this.departments.remove(user.tenantId, code);
  }
}
