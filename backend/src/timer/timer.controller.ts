import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TimerService } from './timer.service';
import { StartTimerDto } from './dto/start-timer.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@ApiTags('Timer')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('timer')
export class TimerController {
  constructor(private timerService: TimerService) {}

  @ApiOperation({ summary: 'Start a new timer' })
  @Post('start')
  start(@Body() dto: StartTimerDto, @Request() req: RequestWithUser) {
    return this.timerService.start(dto, req.user);
  }

  @ApiOperation({ summary: 'Pause the running timer' })
  @Post('pause')
  pause(@Request() req: RequestWithUser) {
    return this.timerService.pause(req.user);
  }

  @ApiOperation({ summary: 'Resume the paused timer' })
  @Post('resume')
  resume(@Request() req: RequestWithUser) {
    return this.timerService.resume(req.user);
  }

  @ApiOperation({ summary: 'Stop the timer and create a time entry' })
  @Post('stop')
  stop(@Request() req: RequestWithUser) {
    return this.timerService.stop(req.user);
  }

  @ApiOperation({ summary: 'Get current timer status' })
  @Get('status')
  getStatus(@Request() req: RequestWithUser) {
    return this.timerService.getStatus(req.user);
  }

  @ApiOperation({ summary: 'Discard the active timer without saving' })
  @Delete('discard')
  discard(@Request() req: RequestWithUser) {
    return this.timerService.discard(req.user);
  }
}
