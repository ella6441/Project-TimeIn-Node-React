import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ReportFiltersDto } from './dto/report-filters.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

const REPORT_CACHE_TTL = 300;

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async byEmployee(requester: AuthenticatedUser, filters: ReportFiltersDto) {
    const cacheKey = this.cacheKey('by-employee', requester.id, filters);
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as unknown[];

    let teamUserIds: string[] | undefined;
    if (requester.role === 'MANAGER') {
      const members = await this.prisma.user.findMany({
        where: { team: requester.team ?? undefined },
        select: { id: true },
      });
      teamUserIds = members.map((m) => m.id);
    }

    const where = this.buildWhere(filters, teamUserIds);

    const [grouped, projectGroups] = await Promise.all([
      this.prisma.timeEntry.groupBy({
        by: ['userId'],
        where,
        _sum: { durationMinutes: true },
        _count: { _all: true },
        orderBy: { _sum: { durationMinutes: 'desc' } },
      }),
      this.prisma.timeEntry.groupBy({
        by: ['userId', 'projectId'],
        where,
      }),
    ]);

    if (!grouped.length) return [];

    const userIds = grouped.map((g) => g.userId);
    const projectIds = [...new Set(projectGroups.map((g) => g.projectId))];

    const [users, projects] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, fullName: true, team: true },
      }),
      this.prisma.project.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, projectName: true },
      }),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));
    const projectMap = new Map(projects.map((p) => [p.id, p.projectName]));
    const userProjectsMap = new Map<string, string[]>();
    for (const g of projectGroups) {
      const list = userProjectsMap.get(g.userId) ?? [];
      list.push(projectMap.get(g.projectId) ?? 'Unknown');
      userProjectsMap.set(g.userId, list);
    }

    const result = grouped.map((g) => ({
      userId: g.userId,
      fullName: userMap.get(g.userId)?.fullName ?? 'Unknown',
      team: userMap.get(g.userId)?.team ?? null,
      totalMinutes: g._sum.durationMinutes ?? 0,
      entryCount: g._count._all,
      activeProjects: userProjectsMap.get(g.userId) ?? [],
    }));

    await this.redis.set(cacheKey, JSON.stringify(result), REPORT_CACHE_TTL);
    return result;
  }

  async byProject(requester: AuthenticatedUser, filters: ReportFiltersDto) {
    const cacheKey = this.cacheKey('by-project', requester.id, filters);
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as unknown[];

    let teamUserIds: string[] | undefined;
    let managerProjectIds: string[] | undefined;

    if (requester.role === 'MANAGER') {
      const [members, projects] = await Promise.all([
        this.prisma.user.findMany({
          where: { team: requester.team ?? undefined },
          select: { id: true },
        }),
        this.prisma.project.findMany({
          where: { managerId: requester.id },
          select: { id: true },
        }),
      ]);
      teamUserIds = members.map((m) => m.id);
      managerProjectIds = projects.map((p) => p.id);
    }

    const where: any = {
      ...this.buildWhere(filters, teamUserIds),
      ...(managerProjectIds && { projectId: { in: managerProjectIds } }),
    };

    const [grouped, employeeGroups, taskGroups] = await Promise.all([
      this.prisma.timeEntry.groupBy({
        by: ['projectId'],
        where,
        _sum: { durationMinutes: true },
        _count: { _all: true },
        orderBy: { _sum: { durationMinutes: 'desc' } },
      }),
      this.prisma.timeEntry.groupBy({
        by: ['projectId', 'userId'],
        where,
      }),
      this.prisma.timeEntry.groupBy({
        by: ['projectId', 'taskId'],
        where,
        _sum: { durationMinutes: true },
        orderBy: { _sum: { durationMinutes: 'desc' } },
      }),
    ]);

    if (!grouped.length) return [];

    const projectIds = grouped.map((g) => g.projectId);
    const taskIds = [...new Set(taskGroups.map((g) => g.taskId))];

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

    const employeeCountMap = new Map<string, number>();
    for (const g of employeeGroups) {
      employeeCountMap.set(g.projectId, (employeeCountMap.get(g.projectId) ?? 0) + 1);
    }

    const topTasksMap = new Map<string, string[]>();
    for (const g of taskGroups) {
      const list = topTasksMap.get(g.projectId) ?? [];
      if (list.length < 3) list.push(taskMap.get(g.taskId) ?? 'Unknown');
      topTasksMap.set(g.projectId, list);
    }

    const result = grouped.map((g) => ({
      projectId: g.projectId,
      projectName: projectMap.get(g.projectId) ?? 'Unknown',
      totalMinutes: g._sum.durationMinutes ?? 0,
      entryCount: g._count._all,
      employeeCount: employeeCountMap.get(g.projectId) ?? 0,
      topTasks: topTasksMap.get(g.projectId) ?? [],
    }));

    await this.redis.set(cacheKey, JSON.stringify(result), REPORT_CACHE_TTL);
    return result;
  }

  async byTask(requester: AuthenticatedUser, filters: ReportFiltersDto) {
    const cacheKey = this.cacheKey('by-task', requester.id, filters);
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as unknown[];

    let teamUserIds: string[] | undefined;
    let managerProjectIds: string[] | undefined;

    if (requester.role === 'MANAGER') {
      const [members, projects] = await Promise.all([
        this.prisma.user.findMany({
          where: { team: requester.team ?? undefined },
          select: { id: true },
        }),
        this.prisma.project.findMany({
          where: { managerId: requester.id },
          select: { id: true },
        }),
      ]);
      teamUserIds = members.map((m) => m.id);
      managerProjectIds = projects.map((p) => p.id);
    }

    const where: any = {
      ...this.buildWhere(filters, teamUserIds),
      ...(managerProjectIds && { projectId: { in: managerProjectIds } }),
    };

    const [grouped, employeeGroups] = await Promise.all([
      this.prisma.timeEntry.groupBy({
        by: ['taskId'],
        where,
        _sum: { durationMinutes: true },
        _count: { _all: true },
        _max: { date: true },
        orderBy: { _sum: { durationMinutes: 'desc' } },
      }),
      this.prisma.timeEntry.groupBy({
        by: ['taskId', 'userId'],
        where,
        _sum: { durationMinutes: true },
      }),
    ]);

    if (!grouped.length) return [];

    const taskIds = grouped.map((g) => g.taskId);
    const userIds = [...new Set(employeeGroups.map((g) => g.userId))];

    const [tasks, users] = await Promise.all([
      this.prisma.task.findMany({
        where: { id: { in: taskIds } },
        select: { id: true, taskName: true, project: { select: { id: true, projectName: true } } },
      }),
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, fullName: true },
      }),
    ]);

    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const userMap = new Map(users.map((u) => [u.id, u.fullName]));

    const employeesPerTask = new Map<string, { userId: string; fullName: string; minutes: number }[]>();
    for (const g of employeeGroups) {
      const list = employeesPerTask.get(g.taskId) ?? [];
      list.push({
        userId: g.userId,
        fullName: userMap.get(g.userId) ?? 'Unknown',
        minutes: g._sum.durationMinutes ?? 0,
      });
      employeesPerTask.set(g.taskId, list);
    }

    const result = grouped.map((g) => ({
      taskId: g.taskId,
      taskName: taskMap.get(g.taskId)?.taskName ?? 'Unknown',
      projectId: taskMap.get(g.taskId)?.project.id ?? null,
      projectName: taskMap.get(g.taskId)?.project.projectName ?? 'Unknown',
      totalMinutes: g._sum.durationMinutes ?? 0,
      entryCount: g._count._all,
      lastDate: g._max.date,
      employees: employeesPerTask.get(g.taskId) ?? [],
    }));

    await this.redis.set(cacheKey, JSON.stringify(result), REPORT_CACHE_TTL);
    return result;
  }

  async daily(requester: AuthenticatedUser, filters: ReportFiltersDto) {
    const cacheKey = this.cacheKey('daily', requester.id, filters);
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as unknown[];

    let teamUserIds: string[] | undefined;
    if (requester.role === 'MANAGER') {
      const members = await this.prisma.user.findMany({
        where: { team: requester.team ?? undefined },
        select: { id: true },
      });
      teamUserIds = members.map((m) => m.id);
    }

    const where = this.buildWhere(filters, teamUserIds);

    const [grouped, employeeGroups] = await Promise.all([
      this.prisma.timeEntry.groupBy({
        by: ['date'],
        where,
        _sum: { durationMinutes: true },
        _count: { _all: true },
        orderBy: { date: 'asc' },
      }),
      this.prisma.timeEntry.groupBy({
        by: ['date', 'userId'],
        where,
        _sum: { durationMinutes: true },
      }),
    ]);

    if (!grouped.length) return [];

    const userIds = [...new Set(employeeGroups.map((g) => g.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.fullName]));

    const employeesPerDay = new Map<
      string,
      { userId: string; fullName: string; minutes: number }[]
    >();
    for (const g of employeeGroups) {
      const key = g.date.toISOString().split('T')[0];
      const list = employeesPerDay.get(key) ?? [];
      list.push({
        userId: g.userId,
        fullName: userMap.get(g.userId) ?? 'Unknown',
        minutes: g._sum.durationMinutes ?? 0,
      });
      employeesPerDay.set(key, list);
    }

    const result = grouped.map((g) => {
      const dateStr = g.date.toISOString().split('T')[0];
      return {
        date: dateStr,
        totalMinutes: g._sum.durationMinutes ?? 0,
        entryCount: g._count._all,
        employees: employeesPerDay.get(dateStr) ?? [],
      };
    });

    await this.redis.set(cacheKey, JSON.stringify(result), REPORT_CACHE_TTL);
    return result;
  }

  async anomalies(requester: AuthenticatedUser, filters: ReportFiltersDto) {
    let teamUserIds: string[] | undefined;
    if (requester.role === 'MANAGER') {
      const members = await this.prisma.user.findMany({
        where: { team: requester.team ?? undefined },
        select: { id: true },
      });
      teamUserIds = members.map((m) => m.id);
    }

    const where = this.buildWhere(filters, teamUserIds);

    const [longEntries, allEntries] = await Promise.all([
      this.prisma.timeEntry.findMany({
        where: { ...where, durationMinutes: { gt: 480 } },
        include: {
          user: { select: { id: true, fullName: true } },
          project: { select: { id: true, projectName: true } },
          task: { select: { id: true, taskName: true } },
        },
        orderBy: { durationMinutes: 'desc' },
        take: 50,
      }),
      this.prisma.timeEntry.findMany({
        where,
        select: { id: true, userId: true, startTime: true, endTime: true, date: true },
        orderBy: [{ userId: 'asc' }, { startTime: 'asc' }],
      }),
    ]);

    const overlaps: { entry1Id: string; entry2Id: string; userId: string; date: Date }[] = [];
    for (let i = 0; i < allEntries.length - 1; i++) {
      const cur = allEntries[i];
      const next = allEntries[i + 1];
      if (cur.userId === next.userId && cur.endTime > next.startTime) {
        overlaps.push({ entry1Id: cur.id, entry2Id: next.id, userId: cur.userId, date: cur.date });
      }
    }

    let missingDays: { userId: string; fullName: string; date: string }[] = [];
    if (filters.from && filters.to) {
      const targetIds =
        filters.userId
          ? [filters.userId]
          : teamUserIds ??
            (await this.prisma.user.findMany({ select: { id: true } })).map((u) => u.id);
      missingDays = await this.findMissingDays(targetIds, new Date(filters.from), new Date(filters.to));
    }

    return {
      longEntries: longEntries.map((e) => ({
        entryId: e.id,
        userId: e.userId,
        fullName: e.user.fullName,
        date: e.date,
        durationMinutes: e.durationMinutes,
        projectName: e.project.projectName,
        taskName: e.task.taskName,
      })),
      overlaps,
      missingDays,
    };
  }

  private async findMissingDays(
    userIds: string[],
    from: Date,
    to: Date,
  ): Promise<{ userId: string; fullName: string; date: string }[]> {
    const entries = await this.prisma.timeEntry.findMany({
      where: { userId: { in: userIds }, date: { gte: from, lte: to } },
      select: { userId: true, date: true },
    });

    const entrySet = new Set(
      entries.map((e) => `${e.userId}:${e.date.toISOString().split('T')[0]}`),
    );

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const result: { userId: string; fullName: string; date: string }[] = [];
    const current = new Date(from);
    while (current <= to) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) {
        const dateStr = current.toISOString().split('T')[0];
        for (const userId of userIds) {
          if (!entrySet.has(`${userId}:${dateStr}`)) {
            result.push({ userId, fullName: userMap.get(userId)?.fullName ?? 'Unknown', date: dateStr });
          }
        }
      }
      current.setDate(current.getDate() + 1);
    }
    return result;
  }

  private buildWhere(filters: ReportFiltersDto, userIds?: string[]) {
    return {
      ...(userIds && { userId: { in: userIds } }),
      ...(filters.userId && !userIds && { userId: filters.userId }),
      ...(filters.projectId && { projectId: filters.projectId }),
      ...(filters.from && filters.to
        ? { date: { gte: new Date(filters.from), lte: new Date(filters.to) } }
        : filters.from
          ? { date: { gte: new Date(filters.from) } }
          : filters.to
            ? { date: { lte: new Date(filters.to) } }
            : {}),
    };
  }

  private cacheKey(type: string, requesterId: string, filters: ReportFiltersDto): string {
    return `report:${type}:${requesterId}:${JSON.stringify(filters)}`;
  }
}
