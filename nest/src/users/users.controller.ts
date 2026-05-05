import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { UsersService } from './users.service';

interface UserSummary {
  id: string;
  name: string;
  email: string;
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<UserSummary[]> {
    const list = await this.users.listByTenant(user.tenantId);
    // パスワードハッシュは絶対に外向きに出さない
    return list.map((u) => ({ id: u.id, name: u.name, email: u.email }));
  }
}
