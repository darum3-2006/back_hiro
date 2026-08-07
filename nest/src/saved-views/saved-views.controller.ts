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
import { AllowReadonly } from '../auth/allow-readonly.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProjectAccessGuard } from '../auth/project-access.guard';
import { CreateSavedViewDto } from './dto/create-saved-view.dto';
import { UpdateSavedViewDto } from './dto/update-saved-view.dto';
import { SavedViewsService } from './saved-views.service';

@Controller('projects/:projectId/saved-views')
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
export class SavedViewsController {
  constructor(private readonly savedViews: SavedViewsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    return this.savedViews.listForUser(user.tenantId, projectId, user);
  }

  // readonly ユーザーも自分の private ビューは操作可（private 限定は Service 側で担保）
  @Post()
  @AllowReadonly()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateSavedViewDto,
  ) {
    return this.savedViews.create(user.tenantId, projectId, user, dto);
  }

  @Patch(':id')
  @AllowReadonly()
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSavedViewDto,
  ) {
    return this.savedViews.update(user.tenantId, projectId, id, user, dto);
  }

  /** 共有ビューを自分の private ビューとして複製する。 */
  @Post(':id/duplicate')
  @AllowReadonly()
  duplicate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.savedViews.duplicate(user.tenantId, projectId, id, user);
  }

  @Delete(':id')
  @AllowReadonly()
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.savedViews.remove(user.tenantId, projectId, id, user);
  }
}
