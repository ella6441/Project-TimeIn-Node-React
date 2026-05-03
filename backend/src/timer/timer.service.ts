import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { StartTimerDto } from './dto/start-timer.dto';

interface TimerState {
  projectId: string;
  taskId: string;
  description?: string;
  startTime: string;
  pausedAt: string | null;
  totalPausedMs: number;
  status: 'running' | 'paused';
}

const TIMER_TTL = 60 * 60 * 24; // 24 hours — abandoned timers auto-expire

@Injectable()
export class TimerService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async start(dto: StartTimerDto, user: AuthenticatedUser) {
    const existing = await this.getState(user.id);
    if (existing) {
      throw new BadRequestException(
        'A timer is already running. Stop it before starting a new one.',
      );
    }

    const state: TimerState = {
      projectId: dto.projectId,
      taskId: dto.taskId,
      description: dto.description,
      startTime: new Date().toISOString(),
      pausedAt: null,
      totalPausedMs: 0,
      status: 'running',
    };

    await this.redis.set(this.key(user.id), JSON.stringify(state), TIMER_TTL);
    return this.formatResponse(state);
  }

  async pause(user: AuthenticatedUser) {
    const state = await this.requireState(user.id);
    if (state.status === 'paused') {
      throw new BadRequestException('Timer is already paused');
    }

    state.pausedAt = new Date().toISOString();
    state.status = 'paused';

    await this.redis.set(this.key(user.id), JSON.stringify(state), TIMER_TTL);
    return this.formatResponse(state);
  }

  async resume(user: AuthenticatedUser) {
    const state = await this.requireState(user.id);
    if (state.status === 'running') {
      throw new BadRequestException('Timer is already running');
    }

    const pausedMs = new Date().getTime() - new Date(state.pausedAt!).getTime();
    state.totalPausedMs += pausedMs;
    state.pausedAt = null;
    state.status = 'running';

    await this.redis.set(this.key(user.id), JSON.stringify(state), TIMER_TTL);
    return this.formatResponse(state);
  }

  async stop(user: AuthenticatedUser) {
    const state = await this.requireState(user.id);

    const now = new Date();
    const start = new Date(state.startTime);
    const totalMs =
      now.getTime() -
      start.getTime() -
      state.totalPausedMs -
      (state.pausedAt ? now.getTime() - new Date(state.pausedAt).getTime() : 0);

    const durationMinutes = Math.max(1, Math.round(totalMs / 60000));

    const entry = await this.prisma.timeEntry.create({
      data: {
        userId: user.id,
        projectId: state.projectId,
        taskId: state.taskId,
        date: start,
        startTime: start,
        endTime: now,
        durationMinutes,
        source: 'TIMER',
        status: 'DRAFT',
        description: state.description,
        workType: 'DEVELOPMENT',
      },
      include: {
        project: { select: { id: true, projectName: true } },
        task: { select: { id: true, taskName: true } },
      },
    });

    await this.redis.del(this.key(user.id));
    return entry;
  }

  async getStatus(user: AuthenticatedUser) {
    const state = await this.getState(user.id);
    if (!state) return { active: false };
    return { active: true, ...this.formatResponse(state) };
  }

  async discard(user: AuthenticatedUser) {
    await this.requireState(user.id);
    await this.redis.del(this.key(user.id));
    return { message: 'Timer discarded' };
  }

  private async getState(userId: string): Promise<TimerState | null> {
    const raw = await this.redis.get(this.key(userId));
    if (!raw) return null;
    return JSON.parse(raw) as TimerState;
  }

  private async requireState(userId: string): Promise<TimerState> {
    const state = await this.getState(userId);
    if (!state) throw new NotFoundException('No active timer found');
    return state;
  }

  private formatResponse(state: TimerState) {
    const now = new Date();
    const start = new Date(state.startTime);
    let elapsedMs = now.getTime() - start.getTime() - state.totalPausedMs;
    if (state.status === 'paused' && state.pausedAt) {
      elapsedMs -= now.getTime() - new Date(state.pausedAt).getTime();
    }
    const safeMs = Math.max(0, elapsedMs);

    return {
      status: state.status,
      projectId: state.projectId,
      taskId: state.taskId,
      description: state.description,
      startTime: state.startTime,
      elapsedMinutes: Math.floor(safeMs / 60000),
      elapsedMs: safeMs,
    };
  }

  private key(userId: string): string {
    return `timer:${userId}`;
  }
}
