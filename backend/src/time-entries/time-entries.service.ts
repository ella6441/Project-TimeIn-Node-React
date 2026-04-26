import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { paginate, getSkip } from '../common/helpers/paginate.helper';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Injectable()
export class TimeEntriesService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
  ) {}

  async create(dto: CreateTimeEntryDto, user: AuthenticatedUser) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);

    if (end <= start) {
      throw new BadRequestException('End time must be after start time');
    }

    await this.checkRetroactive(new Date(dto.date));

    const durationMinutes = Math.round(
      (end.getTime() - start.getTime()) / 60000,
    );

    const overlap = await this.prisma.timeEntry.findFirst({
      where: {
        userId: user.id,
        AND: [{ startTime: { lt: end } }, { endTime: { gt: start } }],
      },
    });
    if (overlap) {
      throw new BadRequestException(
        'Time entry overlaps with an existing entry',
      );
    }

    return this.prisma.timeEntry.create({
      data: {
        userId: user.id,
        projectId: dto.projectId,
        taskId: dto.taskId,
        date: new Date(dto.date),
        startTime: start,
        endTime: end,
        durationMinutes,
        workType: dto.workType ?? 'DEVELOPMENT',
        description: dto.description,
        source: dto.source ?? 'MANUAL',
        relatedCommitHash: dto.relatedCommitHash,
        relatedClickUpTaskId: dto.relatedClickUpTaskId,
      },
      include: {
        project: { select: { id: true, projectName: true } },
        task: { select: { id: true, taskName: true } },
      },
    });
  }

  async findMine(
    userId: string,
    pagination: PaginationDto,
    filters: { projectId?: string; from?: string; to?: string; status?: string },
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;
    const where = {
      userId,
      ...(filters.projectId && { projectId: filters.projectId }),
      ...(filters.status && { status: filters.status }),
      ...(filters.from && { date: { gte: new Date(filters.from) } }),
      ...(filters.to && { date: { lte: new Date(filters.to) } }),
    };

    const [entries, total] = await Promise.all([
      this.prisma.timeEntry.findMany({
        where,
        skip: getSkip(page, limit),
        take: limit,
        include: {
          project: { select: { id: true, projectName: true } },
          task: { select: { id: true, taskName: true } },
        },
        orderBy: { date: 'desc' },
      }),
      this.prisma.timeEntry.count({ where }),
    ]);

    return paginate(entries, total, page, limit);
  }

  async findAll(
    requester: AuthenticatedUser,
    pagination: PaginationDto,
    filters: {
      userId?: string;
      projectId?: string;
      taskId?: string;
      status?: string;
      from?: string;
      to?: string;
    },
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;

    let userIdFilter: string | { in: string[] } | undefined =
      filters.userId || undefined;

    if (requester.role === 'MANAGER') {
      const teamMembers = await this.prisma.user.findMany({
        where: { team: requester.team ?? undefined },
        select: { id: true },
      });
      const teamIds = teamMembers.map((u) => u.id);
      userIdFilter =
        filters.userId && teamIds.includes(filters.userId)
          ? filters.userId
          : { in: teamIds };
    }

    const where = {
      ...(userIdFilter && { userId: userIdFilter }),
      ...(filters.projectId && { projectId: filters.projectId }),
      ...(filters.taskId && { taskId: filters.taskId }),
      ...(filters.status && { status: filters.status }),
      ...(filters.from && { date: { gte: new Date(filters.from) } }),
      ...(filters.to && { date: { lte: new Date(filters.to) } }),
    };

    const [entries, total] = await Promise.all([
      this.prisma.timeEntry.findMany({
        where,
        skip: getSkip(page, limit),
        take: limit,
        include: {
          user: { select: { id: true, fullName: true } },
          project: { select: { id: true, projectName: true } },
          task: { select: { id: true, taskName: true } },
        },
        orderBy: { date: 'desc' },
      }),
      this.prisma.timeEntry.count({ where }),
    ]);

    return paginate(entries, total, page, limit);
  }

  async getMyBreakdown(userId: string, filters: { from?: string; to?: string }) {
    const where = {
      userId,
      ...(filters.from && filters.to
        ? { date: { gte: new Date(filters.from), lte: new Date(filters.to) } }
        : filters.from
          ? { date: { gte: new Date(filters.from) } }
          : filters.to
            ? { date: { lte: new Date(filters.to) } }
            : {}),
    };

    const [byProject, byTask] = await Promise.all([
      this.prisma.timeEntry.groupBy({
        by: ['projectId'],
        where,
        _sum: { durationMinutes: true },
        _count: { _all: true },
        orderBy: { _sum: { durationMinutes: 'desc' } },
      }),
      this.prisma.timeEntry.groupBy({
        by: ['taskId'],
        where,
        _sum: { durationMinutes: true },
        _count: { _all: true },
        orderBy: { _sum: { durationMinutes: 'desc' } },
      }),
    ]);

    const projectIds = byProject.map((g) => g.projectId);
    const taskIds = byTask.map((g) => g.taskId);

    const [projects, tasks] = await Promise.all([
      this.prisma.project.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, projectName: true },
      }),
      this.prisma.task.findMany({
        where: { id: { in: taskIds } },
        select: { id: true, taskName: true },
      }),
    ]);

    const projectMap = new Map(projects.map((p) => [p.id, p.projectName]));
    const taskMap = new Map(tasks.map((t) => [t.id, t.taskName]));

    return {
      byProject: byProject.map((g) => ({
        projectId: g.projectId,
        projectName: projectMap.get(g.projectId) ?? 'Unknown',
        totalMinutes: g._sum.durationMinutes ?? 0,
        entryCount: g._count._all,
      })),
      byTask: byTask.map((g) => ({
        taskId: g.taskId,
        taskName: taskMap.get(g.taskId) ?? 'Unknown',
        totalMinutes: g._sum.durationMinutes ?? 0,
        entryCount: g._count._all,
      })),
    };
  }

  async getSummary(userId: string) {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [today, week, month] = await Promise.all([
      this.prisma.timeEntry.aggregate({
        where: { userId, date: { gte: todayStart } },
        _sum: { durationMinutes: true },
      }),
      this.prisma.timeEntry.aggregate({
        where: { userId, date: { gte: weekStart } },
        _sum: { durationMinutes: true },
      }),
      this.prisma.timeEntry.aggregate({
        where: { userId, date: { gte: monthStart } },
        _sum: { durationMinutes: true },
      }),
    ]);

    return {
      todayMinutes: today._sum.durationMinutes ?? 0,
      weekMinutes: week._sum.durationMinutes ?? 0,
      monthMinutes: month._sum.durationMinutes ?? 0,
    };
  }

  async update(
    id: string,
    dto: Partial<CreateTimeEntryDto>,
    user: AuthenticatedUser,
  ) {
    const entry = await this.prisma.timeEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Time entry not found');
    if (entry.userId !== user.id && user.role === 'EMPLOYEE') {
      throw new ForbiddenException('Not allowed');
    }

    const start = dto.startTime ? new Date(dto.startTime) : entry.startTime;
    const end = dto.endTime ? new Date(dto.endTime) : entry.endTime;

    if (end <= start)
      throw new BadRequestException('End time must be after start time');

    const durationMinutes = Math.round(
      (end.getTime() - start.getTime()) / 60000,
    );

    return this.prisma.timeEntry.update({
      where: { id },
      data: {
        ...(dto.projectId && { projectId: dto.projectId }),
        ...(dto.taskId && { taskId: dto.taskId }),
        ...(dto.date && { date: new Date(dto.date) }),
        startTime: start,
        endTime: end,
        durationMinutes,
        ...(dto.workType && { workType: dto.workType }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.relatedCommitHash !== undefined && {
          relatedCommitHash: dto.relatedCommitHash,
        }),
        ...(dto.relatedClickUpTaskId !== undefined && {
          relatedClickUpTaskId: dto.relatedClickUpTaskId,
        }),
      },
    });
  }

  async submit(id: string, userId: string) {
    const entry = await this.prisma.timeEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Time entry not found');
    if (entry.userId !== userId) throw new ForbiddenException('Not allowed');
    return this.prisma.timeEntry.update({
      where: { id },
      data: { status: 'SUBMITTED' },
    });
  }

  async approve(id: string, requester: AuthenticatedUser) {
    const entry = await this.prisma.timeEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Time entry not found');
    if (entry.status !== 'SUBMITTED') {
      throw new BadRequestException('Only submitted entries can be approved');
    }
    if (requester.role === 'MANAGER') {
      const entryOwner = await this.prisma.user.findUnique({
        where: { id: entry.userId },
        select: { team: true },
      });
      if (!entryOwner || entryOwner.team !== requester.team) {
        throw new ForbiddenException('You can only approve entries from your team');
      }
    }
    return this.prisma.timeEntry.update({
      where: { id },
      data: { status: 'APPROVED' },
    });
  }

  async reject(id: string, requester: AuthenticatedUser) {
    const entry = await this.prisma.timeEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Time entry not found');
    if (entry.status !== 'SUBMITTED') {
      throw new BadRequestException('Only submitted entries can be rejected');
    }
    if (requester.role === 'MANAGER') {
      const entryOwner = await this.prisma.user.findUnique({
        where: { id: entry.userId },
        select: { team: true },
      });
      if (!entryOwner || entryOwner.team !== requester.team) {
        throw new ForbiddenException('You can only reject entries from your team');
      }
    }
    return this.prisma.timeEntry.update({
      where: { id },
      data: { status: 'REJECTED' },
    });
  }

  async copy(id: string, user: AuthenticatedUser) {
    const entry = await this.prisma.timeEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Time entry not found');
    if (entry.userId !== user.id && user.role === 'EMPLOYEE') {
      throw new ForbiddenException('Not allowed');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.prisma.timeEntry.create({
      data: {
        userId: user.id,
        projectId: entry.projectId,
        taskId: entry.taskId,
        date: today,
        startTime: entry.startTime,
        endTime: entry.endTime,
        durationMinutes: entry.durationMinutes,
        workType: entry.workType,
        description: entry.description,
        source: 'MANUAL',
        status: 'DRAFT',
        relatedCommitHash: entry.relatedCommitHash,
        relatedClickUpTaskId: entry.relatedClickUpTaskId,
      },
      include: {
        project: { select: { id: true, projectName: true } },
        task: { select: { id: true, taskName: true } },
      },
    });
  }

  private async checkRetroactive(date: Date) {
    const allowed = await this.settings.get('allow_retroactive');
    if (allowed === 'false') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date < today) {
        throw new BadRequestException('Retroactive time reporting is disabled');
      }
      return;
    }
    const maxDaysStr = await this.settings.get('max_retroactive_days');
    const maxDays = parseInt(maxDaysStr ?? '30', 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxDays);
    cutoff.setHours(0, 0, 0, 0);
    if (date < cutoff) {
      throw new BadRequestException(
        `Cannot report time entries older than ${maxDays} days`,
      );
    }
  }

  async delete(id: string, user: AuthenticatedUser) {
    const entry = await this.prisma.timeEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Time entry not found');
    if (entry.userId !== user.id && user.role === 'EMPLOYEE') {
      throw new ForbiddenException('Not allowed');
    }
    return this.prisma.timeEntry.delete({ where: { id } });
  }
}
