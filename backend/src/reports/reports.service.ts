import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ReportFiltersDto } from './dto/report-filters.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

const REPORT_CACHE_TTL = 120;

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
        where: { managerId: requester.id },
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
          where: { managerId: requester.id },
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
        select: { id: true, projectName: true, status: true },
      }),
      this.prisma.task.findMany({
        where: { id: { in: taskIds } },
        select: { id: true, taskName: true },
      }),
    ]);

    const projectMap = new Map(projects.map((p) => [p.id, p]));
    const taskMap = new Map(tasks.map((t) => [t.id, t.taskName]));

    const employeeUserIds = [...new Set(employeeGroups.map((g) => g.userId))];
    const employeeUsers = await this.prisma.user.findMany({
      where: { id: { in: employeeUserIds } },
      select: { id: true, fullName: true },
    });
    const employeeUserMap = new Map(
      employeeUsers.map((u) => [u.id, u.fullName]),
    );

    const employeesPerProject = new Map<string, string[]>();
    for (const g of employeeGroups) {
      const list = employeesPerProject.get(g.projectId) ?? [];
      list.push(employeeUserMap.get(g.userId) ?? 'Unknown');
      employeesPerProject.set(g.projectId, list);
    }

    const tasksPerProject = new Map<
      string,
      { taskName: string; totalMinutes: number }[]
    >();
    for (const g of taskGroups) {
      const list = tasksPerProject.get(g.projectId) ?? [];
      list.push({
        taskName: taskMap.get(g.taskId) ?? 'Unknown',
        totalMinutes: g._sum.durationMinutes ?? 0,
      });
      tasksPerProject.set(g.projectId, list);
    }

    const result = grouped.map((g) => ({
      projectId: g.projectId,
      projectName: projectMap.get(g.projectId)?.projectName ?? 'Unknown',
      status: projectMap.get(g.projectId)?.status ?? 'ACTIVE',
      totalMinutes: g._sum.durationMinutes ?? 0,
      entryCount: g._count._all,
      employees: employeesPerProject.get(g.projectId) ?? [],
      taskBreakdown: tasksPerProject.get(g.projectId) ?? [],
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
          where: { managerId: requester.id },
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
        select: {
          id: true,
          taskName: true,
          project: { select: { id: true, projectName: true } },
        },
      }),
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, fullName: true },
      }),
    ]);

    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const userMap = new Map(users.map((u) => [u.id, u.fullName]));

    const employeesPerTask = new Map<
      string,
      { userId: string; fullName: string; minutes: number }[]
    >();
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
        where: { managerId: requester.id },
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
        where: { managerId: requester.id },
        select: { id: true },
      });
      teamUserIds = members.map((m) => m.id);
    }

    const where = this.buildWhere(filters, teamUserIds);

    const [longEntries, allEntries, draftEntries] = await Promise.all([
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
        select: {
          id: true,
          userId: true,
          startTime: true,
          endTime: true,
          date: true,
        },
        orderBy: [{ userId: 'asc' }, { startTime: 'asc' }],
      }),
      this.prisma.timeEntry.findMany({
        where: { ...where, status: 'DRAFT' },
        include: {
          user: { select: { fullName: true } },
          project: { select: { projectName: true } },
          task: { select: { taskName: true } },
        },
        orderBy: { date: 'desc' },
        take: 100,
      }),
    ]);

    const overlapUserIds = new Set<string>();
    const rawOverlaps: {
      entry1Id: string;
      entry2Id: string;
      userId: string;
      date: Date;
      start1: Date;
      end1: Date;
      start2: Date;
      end2: Date;
    }[] = [];
    for (let i = 0; i < allEntries.length - 1; i++) {
      const cur = allEntries[i];
      const next = allEntries[i + 1];
      if (cur.userId === next.userId && cur.endTime > next.startTime) {
        overlapUserIds.add(cur.userId);
        rawOverlaps.push({
          entry1Id: cur.id,
          entry2Id: next.id,
          userId: cur.userId,
          date: cur.date,
          start1: cur.startTime,
          end1: cur.endTime,
          start2: next.startTime,
          end2: next.endTime,
        });
      }
    }

    const overlapUsers = await this.prisma.user.findMany({
      where: { id: { in: [...overlapUserIds] } },
      select: { id: true, fullName: true },
    });
    const overlapUserMap = new Map(overlapUsers.map((u) => [u.id, u.fullName]));

    const overlaps = rawOverlaps.map((o) => ({
      ...o,
      fullName: overlapUserMap.get(o.userId) ?? 'Unknown',
    }));

    let missingDays: { userId: string; fullName: string; date: string }[] = [];
    if (filters.from && filters.to) {
      const targetIds = filters.userId
        ? [filters.userId]
        : (teamUserIds ??
          (await this.prisma.user.findMany({ select: { id: true } })).map(
            (u) => u.id,
          ));
      missingDays = await this.findMissingDays(
        targetIds,
        new Date(filters.from),
        new Date(filters.to),
      );
    }

    return {
      longEntries: longEntries.map((e) => ({
        entryId: e.id,
        userId: e.userId,
        fullName: e.user.fullName,
        date: e.date,
        durationMinutes: e.durationMinutes,
        projectName: e.project.projectName,
        taskName: e.task?.taskName ?? null,
      })),
      draftEntries: draftEntries.map((e) => ({
        entryId: e.id,
        userId: e.userId,
        fullName: e.user.fullName,
        date: e.date,
        durationMinutes: e.durationMinutes,
        projectName: e.project.projectName,
        taskName: e.task?.taskName ?? null,
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
            result.push({
              userId,
              fullName: userMap.get(userId)?.fullName ?? 'Unknown',
              date: dateStr,
            });
          }
        }
      }
      current.setDate(current.getDate() + 1);
    }
    return result;
  }

  async gitGaps(requester: AuthenticatedUser, filters: ReportFiltersDto) {
    let targetUserIds: string[];

    if (requester.role === 'EMPLOYEE') {
      targetUserIds = [requester.id];
    } else if (requester.role === 'MANAGER') {
      const members = await this.prisma.user.findMany({
        where: { managerId: requester.id },
        select: { id: true },
      });
      targetUserIds = members.map((m) => m.id);
      if (!targetUserIds.includes(requester.id)) targetUserIds.push(requester.id);
    } else {
      const all = await this.prisma.user.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      targetUserIds = all.map((u) => u.id);
    }

    if (filters.userId && targetUserIds.includes(filters.userId)) {
      targetUserIds = [filters.userId];
    }

    const fromDate = filters.from ? new Date(filters.from) : undefined;
    const toDate = filters.to ? new Date(filters.to) : undefined;

    const [commits, entries, users] = await Promise.all([
      this.prisma.gitCommit.findMany({
        where: {
          linkedUserId: { in: targetUserIds },
          ...(fromDate && { commitDate: { gte: fromDate } }),
          ...(toDate && { commitDate: { lte: toDate } }),
        },
        select: { linkedUserId: true, commitDate: true },
      }),
      this.prisma.timeEntry.findMany({
        where: {
          userId: { in: targetUserIds },
          ...(fromDate && toDate
            ? { date: { gte: fromDate, lte: toDate } }
            : fromDate
              ? { date: { gte: fromDate } }
              : toDate
                ? { date: { lte: toDate } }
                : {}),
        },
        select: { userId: true, date: true },
      }),
      this.prisma.user.findMany({
        where: { id: { in: targetUserIds } },
        select: { id: true, fullName: true },
      }),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u.fullName]));

    const commitsByUser = new Map<string, Map<string, number>>();
    for (const c of commits) {
      if (!c.linkedUserId) continue;
      const dateStr = c.commitDate.toISOString().split('T')[0];
      const days = commitsByUser.get(c.linkedUserId) ?? new Map<string, number>();
      days.set(dateStr, (days.get(dateStr) ?? 0) + 1);
      commitsByUser.set(c.linkedUserId, days);
    }

    const entryDaysByUser = new Map<string, Set<string>>();
    for (const e of entries) {
      const dateStr = e.date.toISOString().split('T')[0];
      const days = entryDaysByUser.get(e.userId) ?? new Set<string>();
      days.add(dateStr);
      entryDaysByUser.set(e.userId, days);
    }

    return targetUserIds
      .filter((uid) => commitsByUser.has(uid))
      .map((uid) => {
        const commitDays = commitsByUser.get(uid)!;
        const entryDays = entryDaysByUser.get(uid) ?? new Set<string>();
        const gaps = [...commitDays.entries()]
          .filter(([date]) => !entryDays.has(date))
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, commitCount]) => ({ date, commitCount }));
        return {
          userId: uid,
          fullName: userMap.get(uid) ?? 'Unknown',
          commitDays: commitDays.size,
          entryDays: entryDays.size,
          gapDays: gaps.length,
          gaps,
        };
      })
      .sort((a, b) => b.gapDays - a.gapDays);
  }

  private buildWhere(filters: ReportFiltersDto, userIds?: string[]) {
    let userFilter: object = {};
    if (filters.userId) {
      // specific employee selected — for MANAGER verify they're in the team
      const allowed = !userIds || userIds.includes(filters.userId);
      userFilter = allowed
        ? { userId: filters.userId }
        : { userId: { in: userIds } };
    } else if (userIds) {
      userFilter = { userId: { in: userIds } };
    }

    return {
      ...userFilter,
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

  private cacheKey(
    type: string,
    requesterId: string,
    filters: ReportFiltersDto,
  ): string {
    return `report:${type}:${requesterId}:${JSON.stringify(filters)}`;
  }
}
