import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IntegrationsService } from './integrations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

class LinkCommitDto {
  @IsString()
  commitHash: string;

  @IsString()
  timeEntryId: string;
}

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@ApiTags('Integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(private svc: IntegrationsService) {}

  @ApiOperation({ summary: 'Get integration status' })
  @Get('status')
  getStatus() {
    return this.svc.getStatus();
  }

  @ApiOperation({ summary: 'Sync Git commits from all configured repos (Admin only)' })
  @Roles('ADMIN')
  @Post('git/sync')
  syncGit(@Query('projectId') projectId?: string) {
    return this.svc.syncGitCommits(projectId);
  }

  @ApiOperation({ summary: 'Get synced Git commits' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'repository', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @Get('git/commits')
  getCommits(
    @Request() req: RequestWithUser,
    @Query('userId') userId?: string,
    @Query('repository') repository?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const effectiveUserId =
      req.user.role === 'EMPLOYEE' ? req.user.id : userId;
    return this.svc.getCommits({
      userId: effectiveUserId,
      repository,
      from,
      to,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @ApiOperation({ summary: 'Link a commit hash to a time entry' })
  @Post('git/link')
  linkCommit(@Body() dto: LinkCommitDto) {
    return this.svc.linkCommitToEntry(dto.commitHash, dto.timeEntryId);
  }

  @ApiOperation({ summary: 'Sync tasks from ClickUp (Admin only)' })
  @Roles('ADMIN')
  @Post('clickup/sync')
  syncClickUp(@Query('projectId') projectId?: string) {
    return this.svc.syncClickUpTasks(projectId);
  }

  @ApiOperation({ summary: 'Get synced ClickUp tasks' })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @Get('clickup/tasks')
  getClickUpTasks(
    @Query('projectId') projectId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getClickUpTasks({
      projectId,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}
