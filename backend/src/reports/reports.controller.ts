import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { ReportFiltersDto } from './dto/report-filters.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MANAGER', 'ADMIN')
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @ApiOperation({ summary: 'Total hours grouped by employee' })
  @Get('by-employee')
  byEmployee(
    @Request() req: RequestWithUser,
    @Query() filters: ReportFiltersDto,
  ) {
    return this.reportsService.byEmployee(req.user, filters);
  }

  @ApiOperation({ summary: 'Total hours grouped by project' })
  @Get('by-project')
  byProject(
    @Request() req: RequestWithUser,
    @Query() filters: ReportFiltersDto,
  ) {
    return this.reportsService.byProject(req.user, filters);
  }

  @ApiOperation({ summary: 'Total hours grouped by task' })
  @Get('by-task')
  byTask(@Request() req: RequestWithUser, @Query() filters: ReportFiltersDto) {
    return this.reportsService.byTask(req.user, filters);
  }

  @ApiOperation({ summary: 'Daily breakdown — hours per day with employee detail' })
  @Get('daily')
  daily(@Request() req: RequestWithUser, @Query() filters: ReportFiltersDto) {
    return this.reportsService.daily(req.user, filters);
  }

  @ApiOperation({ summary: 'Anomaly report — long entries and missing days' })
  @Get('anomalies')
  anomalies(@Request() req: RequestWithUser, @Query() filters: ReportFiltersDto) {
    return this.reportsService.anomalies(req.user, filters);
  }
}
