import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { paginate, getSkip } from '../common/helpers/paginate.helper';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Injectable()
export class TimeEntriesService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private notifications: NotificationsService,
  ) {}

  async create(dto: CreateTimeEntryDto, user: AuthenticatedUser) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);

    if (end <= start) {
      throw new BadRequestException('End time must be after start time');
    }

    await this.checkRetroactive(new Date(dto.date));
    await this.checkRequiredFields(dto);
    await this.checkDailyLimit(
      user.id,
      new Date(dto.date),
      Math.round((end.getTime() - start.getTime()) / 60000),
    );

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
    filters: {
      projectId?: string;
      from?: string;
      to?: string;
      status?: string;
    },
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
        where: { managerId: requester.id },
        select: { id: true },
      });
      const teamIds = teamMembers.map((u) => u.id);
      if (!teamIds.includes(requester.id)) teamIds.push(requester.id);
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

  async getMyBreakdown(
    userId: string,
    filters: { from?: string; to?: string },
  ) {
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

    const requireDesc = await this.settings.get('require_description');
    const descValue = dto.description !== undefined ? dto.description : entry.description;
    if (requireDesc === 'true' && !descValue?.trim()) {
      throw new BadRequestException('Description is required');
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
        select: { managerId: true },
      });
      if (!entryOwner) {
        throw new NotFoundException('Entry owner not found');
      }
      if (!entryOwner.managerId) {
        throw new ForbiddenException(
          'This employee is not assigned to any manager',
        );
      }
      if (entryOwner.managerId !== requester.id) {
        throw new ForbiddenException(
          'You can only approve entries from your team',
        );
      }
    }
    const updated = await this.prisma.timeEntry.update({
      where: { id },
      data: { status: 'APPROVED' },
    });
    const dateStr = updated.date.toISOString().slice(0, 10);
    await this.notifications.create(
      entry.userId,
      'Time Entry Approved ✓',
      `Your time entry for ${dateStr} has been approved.`,
    );
    return updated;
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
        select: { managerId: true },
      });
      if (!entryOwner) {
        throw new NotFoundException('Entry owner not found');
      }
      if (!entryOwner.managerId) {
        throw new ForbiddenException(
          'This employee is not assigned to any manager',
        );
      }
      if (entryOwner.managerId !== requester.id) {
        throw new ForbiddenException(
          'You can only reject entries from your team',
        );
      }
    }
    const updated = await this.prisma.timeEntry.update({
      where: { id },
      data: { status: 'REJECTED' },
    });
    const dateStr = updated.date.toISOString().slice(0, 10);
    await this.notifications.create(
      entry.userId,
      'Time Entry Rejected ✗',
      `Your time entry for ${dateStr} has been rejected.`,
    );
    return updated;
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

  private async checkRequiredFields(dto: CreateTimeEntryDto) {
    const requireDesc = await this.settings.get('require_description');
    if (requireDesc === 'true' && !dto.description?.trim()) {
      throw new BadRequestException('Description is required');
    }
    const requireWorkType = await this.settings.get('require_work_type');
    if (requireWorkType === 'true' && !dto.workType) {
      throw new BadRequestException('Work type is required');
    }
  }

  private async checkDailyLimit(
    userId: string,
    date: Date,
    durationMinutes: number,
  ) {
    const maxHoursStr = await this.settings.get('max_daily_hours');
    const maxMinutes = parseInt(maxHoursStr ?? '10', 10) * 60;
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    const existing = await this.prisma.timeEntry.aggregate({
      where: { userId, date: { gte: dayStart, lte: dayEnd } },
      _sum: { durationMinutes: true },
    });
    const alreadyLogged = existing._sum.durationMinutes ?? 0;
    if (alreadyLogged + durationMinutes > maxMinutes) {
      throw new BadRequestException(
        `Adding this entry would exceed the daily limit of ${maxHoursStr} hours`,
      );
    }
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

  async getSuggestions(userId: string, date: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const [commits, gitProjects, clickupTasks, internalTasks] = await Promise.all([
      this.prisma.gitCommit.findMany({
        where: {
          OR: [
            { linkedUserId: userId },
            { authorEmail: user?.email ?? '' },
          ],
          commitDate: { gte: dayStart, lte: dayEnd },
          linkedTimeEntryId: null,
        },
        take: 10,
        orderBy: { commitDate: 'desc' },
      }),
      this.prisma.project.findMany({
        where: { gitRepositoryUrl: { not: null } },
        select: { id: true, projectName: true, gitRepositoryUrl: true },
      }),
      this.prisma.clickUpTaskLink.findMany({
        where: {
          assignedUserId: userId,
          NOT: { status: { in: ['closed', 'complete', 'done', 'completed'] } },
        },
        include: { project: { select: { id: true, projectName: true } } },
        take: 10,
        orderBy: { lastSyncDate: 'desc' },
      }),
      this.prisma.task.findMany({
        where: {
          assignedUserId: userId,
          NOT: { status: { in: ['DONE', 'CANCELLED'] } },
        },
        include: { project: { select: { id: true, projectName: true } } },
        take: 10,
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const gitSuggestions = await Promise.all(
      commits.map(async (c) => {
        const repoSlug = c.repository.split('/').pop() ?? '';
        const project = gitProjects.find(
          (p) => p.gitRepositoryUrl && p.gitRepositoryUrl.includes(repoSlug),
        );

        let taskId: string | null = c.linkedTaskId ?? null;
        let taskName: string | null = null;
        if (taskId) {
          const task = await this.prisma.task.findUnique({
            where: { id: taskId },
            select: { taskName: true },
          });
          taskName = task?.taskName ?? null;
        }

        return {
          source: 'GIT',
          description: c.commitMessage.split('\n')[0].slice(0, 200),
          projectId: project?.id ?? null,
          projectName: project?.projectName ?? null,
          taskId,
          taskName,
          durationMinutes: 30,
          date,
          relatedCommitHash: c.commitHash,
          relatedClickUpTaskId: null as string | null,
          workType: 'DEVELOPMENT',
        };
      }),
    );

    const clickupSuggestions = await Promise.all(
      clickupTasks.map(async (t) => {
        const internalTask = await this.prisma.task.findFirst({
          where: { clickUpTaskId: t.clickUpTaskId },
          select: { id: true, taskName: true },
        });

        return {
          source: 'CLICKUP',
          description: t.taskName,
          projectId: t.projectId ?? null,
          projectName: t.project?.projectName ?? null,
          taskId: internalTask?.id ?? null,
          taskName: internalTask?.taskName ?? null,
          durationMinutes: t.estimatedTime ?? 60,
          date,
          relatedCommitHash: null as string | null,
          relatedClickUpTaskId: t.clickUpTaskId,
          workType: 'DEVELOPMENT',
        };
      }),
    );

    const internalTaskSuggestions = internalTasks.map((t) => ({
      source: 'SUGGESTED',
      description: t.taskName,
      projectId: t.projectId,
      projectName: t.project.projectName,
      taskId: t.id,
      taskName: t.taskName,
      durationMinutes: t.estimatedHours ? Math.round(t.estimatedHours * 60) : 60,
      date,
      relatedCommitHash: null as string | null,
      relatedClickUpTaskId: t.clickUpTaskId ?? null,
      workType: 'DEVELOPMENT',
    }));

    return { suggestions: [...gitSuggestions, ...clickupSuggestions, ...internalTaskSuggestions] };
  }
}
