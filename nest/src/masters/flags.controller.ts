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
import { ProjectAccessGuard } from '../auth/project-access.guard';
import { CreateFlagDto } from './dto/create-flag.dto';
import { FlagTargetDto } from './dto/flag-target.dto';
import { UpdateFlagDto } from './dto/update-flag.dto';
import { FlagsService } from './flags.service';

@Controller('projects/:projectId/flags')
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
export class FlagsController {
  constructor(private readonly flags: FlagsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    return this.flags.listByProject(user.tenantId, projectId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateFlagDto,
  ) {
    return this.flags.create(user.tenantId, projectId, dto);
  }

  @Patch(':code')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('code') code: string,
    @Body() dto: UpdateFlagDto,
  ) {
    return this.flags.update(user.tenantId, projectId, code, dto);
  }

  /** source フラグが付いた全タスクに target フラグを追加する（source は残す）。 */
  @Post(':code/copy')
  @HttpCode(204)
  copy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('code') code: string,
    @Body() dto: FlagTargetDto,
  ) {
    return this.flags.copyToFlag(user.tenantId, projectId, user.userId, code, dto.targetCode);
  }

  /** source フラグが付いた全タスクで source を外し target フラグを付与する。 */
  @Post(':code/move')
  @HttpCode(204)
  move(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('code') code: string,
    @Body() dto: FlagTargetDto,
  ) {
    return this.flags.moveToFlag(user.tenantId, projectId, user.userId, code, dto.targetCode);
  }

  /** このフラグを全タスクから外す（フラグ定義は残す）。 */
  @Delete(':code/assignments')
  @HttpCode(204)
  detachAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('code') code: string,
  ) {
    return this.flags.detachFromAllTasks(user.tenantId, projectId, user.userId, code);
  }

  @Delete(':code')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('code') code: string,
  ) {
    return this.flags.remove(user.tenantId, projectId, code);
  }
}
