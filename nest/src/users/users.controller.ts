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
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProjectAccessService } from '../projects/project-access.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import type { User, UserRole } from './user.entity';
import { UsersService } from './users.service';

interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** 有効フラグ（false=ログイン不可） */
  isActive: boolean;
  /**
   * 閲覧を許可されたプロジェクト。admin はこの設定に関係なく全件見られる。
   * 設定できるのは admin だけなので、admin 以外には返さない（`undefined`）。
   * この一覧はメンション候補の取得などで全ユーザーが叩くため、他人の閲覧範囲や
   * 自分に見えないプロジェクトの ID を漏らさないようにする。
   */
  projectIds?: string[];
}

const toSummary = (u: User, projectIds: string[] | undefined): UserSummary => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  isActive: u.isActive,
  ...(projectIds === undefined ? {} : { projectIds }),
});

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly access: ProjectAccessService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<UserSummary[]> {
    const isAdmin = user.role === 'admin';
    const [list, accessByUser] = await Promise.all([
      this.users.listByTenant(user.tenantId),
      isAdmin ? this.access.listProjectIdsByUser(user.tenantId) : null,
    ]);
    // パスワードハッシュは絶対に外向きに出さない
    return list.map((u) => toSummary(u, accessByUser ? (accessByUser.get(u.id) ?? []) : undefined));
  }

  @Post()
  @UseGuards(AdminGuard)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUserDto,
  ): Promise<UserSummary> {
    const created = await this.users.create(user.tenantId, dto);
    // 明示付与運用なので、指定が無ければ 0 件のまま
    await this.access.replaceForUser(user.tenantId, created.id, dto.projectIds ?? []);
    return toSummary(created, await this.access.listProjectIds(user.tenantId, created.id));
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserSummary> {
    const updated = await this.users.update(user.tenantId, user.userId, id, dto);
    if (dto.projectIds !== undefined) {
      await this.access.replaceForUser(user.tenantId, updated.id, dto.projectIds);
    }
    return toSummary(updated, await this.access.listProjectIds(user.tenantId, updated.id));
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(204)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.users.remove(user.tenantId, user.userId, id);
  }
}
