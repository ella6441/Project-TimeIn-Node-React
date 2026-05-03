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
import { TimeEntriesService } from './time-entries.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@ApiTags('Time Entries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('time-entries')
export class TimeEntriesController {
  constructor(private timeEntriesService: TimeEntriesService) {}

  @ApiOperation({ summary: 'Create a new time entry' })
  @Post()
  create(@Body() dto: CreateTimeEntryDto, @Request() req: RequestWithUser) {
    return this.timeEntriesService.create(dto, req.user);
  }

  @ApiOperation({ summary: 'Get my time entries with pagination' })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'],
  })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @Get('mine')
  findMine(
    @Request() req: RequestWithUser,
    @Query() pagination: PaginationDto,
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.timeEntriesService.findMine(req.user.id, pagination, {
      projectId,
      status,
      from,
      to,
    });
  }

  @ApiOperation({ summary: 'Get my hours summary (today / week / month)' })
  @Get('summary')
  getSummary(@Request() req: RequestWithUser) {
    return this.timeEntriesService.getSummary(req.user.id);
  }

  @ApiOperation({ summary: 'Get auto-suggestions based on Git commits and ClickUp tasks for a given date' })
  @ApiQuery({ name: 'date', required: false, description: 'YYYY-MM-DD (defaults to today)' })
  @Get('suggestions')
  getSuggestions(@Request() req: RequestWithUser, @Query('date') date?: string) {
    const targetDate = date ?? new Date().toISOString().slice(0, 10);
    return this.timeEntriesService.getSuggestions(req.user.id, targetDate);
  }

  @ApiOperation({ summary: 'Get my hours breakdown by project and task' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @Get('my-breakdown')
  getMyBreakdown(
    @Request() req: RequestWithUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.timeEntriesService.getMyBreakdown(req.user.id, { from, to });
  }

  @ApiOperation({
    summary: 'Get all time entries with pagination (Manager/Admin only)',
  })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'taskId', required: false })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'],
  })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @Roles('MANAGER', 'ADMIN')
  @Get()
  findAll(
    @Request() req: RequestWithUser,
    @Query() pagination: PaginationDto,
    @Query('userId') userId?: string,
    @Query('projectId') projectId?: string,
    @Query('taskId') taskId?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.timeEntriesService.findAll(req.user, pagination, {
      userId,
      projectId,
      taskId,
      status,
      from,
      to,
    });
  }

  @ApiOperation({
    summary: 'Approve a submitted time entry (Manager/Admin only)',
  })
  @Roles('MANAGER', 'ADMIN')
  @Patch(':id/approve')
  approve(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.timeEntriesService.approve(id, req.user);
  }

  @ApiOperation({
    summary: 'Reject a submitted time entry (Manager/Admin only)',
  })
  @Roles('MANAGER', 'ADMIN')
  @Patch(':id/reject')
  reject(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.timeEntriesService.reject(id, req.user);
  }

  @ApiOperation({ summary: 'Update a time entry' })
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateTimeEntryDto>,
    @Request() req: RequestWithUser,
  ) {
    return this.timeEntriesService.update(id, dto, req.user);
  }

  @ApiOperation({ summary: 'Submit a time entry for review' })
  @Patch(':id/submit')
  submit(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.timeEntriesService.submit(id, req.user.id);
  }

  @ApiOperation({ summary: 'Copy a time entry to today as a new draft' })
  @Post(':id/copy')
  copy(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.timeEntriesService.copy(id, req.user);
  }

  @ApiOperation({ summary: 'Delete a time entry' })
  @Delete(':id')
  delete(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.timeEntriesService.delete(id, req.user);
  }
}
