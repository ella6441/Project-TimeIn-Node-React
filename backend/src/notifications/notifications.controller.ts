import {
  Controller, Get, Patch, Post, Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @ApiOperation({ summary: 'Get my notifications' })
  @Get()
  findMine(@Request() req: RequestWithUser, @Query() pagination: PaginationDto) {
    return this.notificationsService.findMine(req.user.id, pagination);
  }

  @ApiOperation({ summary: 'Count unread notifications' })
  @Get('unread-count')
  countUnread(@Request() req: RequestWithUser) {
    return this.notificationsService.countUnread(req.user.id);
  }

  @ApiOperation({ summary: 'Mark all notifications as read' })
  @Patch('read-all')
  markAllRead(@Request() req: RequestWithUser) {
    return this.notificationsService.markAllRead(req.user.id);
  }

  @ApiOperation({ summary: 'Mark a notification as read' })
  @Patch(':id/read')
  markRead(@Param('id') id: string) {
    return this.notificationsService.markRead(id);
  }

  @ApiOperation({ summary: 'Send reminders to employees with no time entries in date range' })
  @Post('remind')
  @Roles('MANAGER', 'ADMIN')
  sendReminders(@Body() body: { from: string; to: string }) {
    return this.notificationsService.sendReminders(body.from, body.to);
  }

  @ApiOperation({ summary: 'Send a reminder to a specific employee for a specific date' })
  @Post('remind-user')
  @Roles('MANAGER', 'ADMIN')
  sendReminderToUser(@Body() body: { userId: string; date: string }) {
    return this.notificationsService.sendReminderToUser(body.userId, body.date);
  }
}
