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
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { TagsService } from './tags.service';

@Controller('projects/:projectId/tags')
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    return this.tags.listByProject(user.tenantId, projectId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateTagDto,
  ) {
    return this.tags.create(user.tenantId, projectId, dto);
  }

  @Patch(':code')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('code') code: string,
    @Body() dto: UpdateTagDto,
  ) {
    return this.tags.update(user.tenantId, projectId, code, dto);
  }

  @Delete(':code')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('code') code: string,
  ) {
    return this.tags.remove(user.tenantId, projectId, code);
  }
}
