import { Body, Controller, Get, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TenantsService } from '../tenants/tenants.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedUser } from './jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly tenants: TenantsService,
  ) {}

  // ログインは厳しく: 1分あたり 5 回まで（IP 単位）
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    const u = await this.users.findById(user.userId);
    if (!u) throw new NotFoundException();
    const tenant = await this.tenants.findById(u.tenantId);
    if (!tenant) throw new NotFoundException();
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      tenantId: u.tenantId,
      tenant: { id: tenant.id, key: tenant.key, name: tenant.name },
    };
  }
}
