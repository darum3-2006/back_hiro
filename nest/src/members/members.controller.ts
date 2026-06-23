import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { BulkCreateMembersDto } from './dto/bulk-create-members.dto';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MembersService } from './members.service';

@Controller('projects/:projectId/members')
@UseGuards(JwtAuthGuard)
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    return this.members.listByProject(user.tenantId, projectId);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateMemberDto,
  ) {
    await this.members.assertProjectAdmin(user.tenantId, projectId, user);
    return this.members.create(user.tenantId, projectId, dto);
  }

  /** 表示名を複数まとめて追加（User 紐付け無し・権限一括）。 */
  @Post('bulk')
  async bulkCreate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: BulkCreateMembersDto,
  ) {
    await this.members.assertProjectAdmin(user.tenantId, projectId, user);
    return this.members.bulkCreate(user.tenantId, projectId, dto.displayNames, dto.role);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateMemberDto,
  ) {
    await this.members.assertProjectAdmin(user.tenantId, projectId, user);
    return this.members.update(user.tenantId, projectId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.members.assertProjectAdmin(user.tenantId, projectId, user);
    return this.members.remove(user.tenantId, projectId, id);
  }
}
