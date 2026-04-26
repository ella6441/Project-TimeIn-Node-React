import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
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
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tasks')
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @ApiOperation({ summary: 'Create a new task (Manager/Admin only)' })
  @Roles('ADMIN', 'MANAGER')
  @Post()
  create(@Body() dto: CreateTaskDto, @Request() req: RequestWithUser) {
    return this.tasksService.create(dto, req.user);
  }

  @ApiOperation({
    summary: 'Get all tasks with pagination and optional filters',
  })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @Get()
  findAll(
    @Request() req: RequestWithUser,
    @Query() pagination: PaginationDto,
    @Query('projectId') projectId?: string,
    @Query('userId') userId?: string,
  ) {
    return this.tasksService.findAll(req.user, pagination, projectId, userId);
  }

  @ApiOperation({ summary: 'Get task by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a task (Manager/Admin only)' })
  @Roles('ADMIN', 'MANAGER')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateTaskDto>,
    @Request() req: RequestWithUser,
  ) {
    return this.tasksService.update(id, dto, req.user);
  }

  @ApiOperation({ summary: 'Delete a task (Manager/Admin only)' })
  @Roles('ADMIN', 'MANAGER')
  @Delete(':id')
  delete(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.tasksService.delete(id, req.user);
  }
}
