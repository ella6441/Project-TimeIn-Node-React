import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @ApiOperation({
    summary: 'Create project — Manager creates for own team, Admin for all',
  })
  @Roles('ADMIN', 'MANAGER')
  @Post()
  create(@Body() dto: CreateProjectDto, @Request() req: RequestWithUser) {
    return this.projectsService.create(dto, req.user);
  }

  @ApiOperation({ summary: 'Get projects — Manager sees own, Admin sees all' })
  @Get()
  findAll(@Request() req: RequestWithUser, @Query() pagination: PaginationDto) {
    return this.projectsService.findAll(req.user, pagination);
  }

  @ApiOperation({ summary: 'Get project by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @ApiOperation({
    summary: 'Update project — Manager updates only own projects',
  })
  @Roles('ADMIN', 'MANAGER')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateProjectDto>,
    @Request() req: RequestWithUser,
  ) {
    return this.projectsService.update(id, dto, req.user);
  }

  @ApiOperation({ summary: 'Archive a project (sets status to ARCHIVED)' })
  @Roles('ADMIN', 'MANAGER')
  @Patch(':id/archive')
  archive(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.projectsService.archive(id, req.user);
  }
}
