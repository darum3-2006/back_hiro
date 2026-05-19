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
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import type { User, UserRole } from './user.entity';
import { UsersService } from './users.service';

interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

const toSummary = (u: User): UserSummary => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
});

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<UserSummary[]> {
    const list = await this.users.listByTenant(user.tenantId);
    // パスワードハッシュは絶対に外向きに出さない
    return list.map(toSummary);
  }

  @Post()
  @UseGuards(AdminGuard)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUserDto,
  ): Promise<UserSummary> {
    const created = await this.users.create(user.tenantId, dto);
    return toSummary(created);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserSummary> {
    const updated = await this.users.update(user.tenantId, user.userId, id, dto);
    return toSummary(updated);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(204)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.users.remove(user.tenantId, user.userId, id);
  }
}
