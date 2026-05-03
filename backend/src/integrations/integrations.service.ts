import { Injectable, BadRequestException } from '@nestjs/common';
import * as https from 'https';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class IntegrationsService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
  ) {}

  private fetchJson<T>(url: string, headers: Record<string, string>): Promise<T> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'TimeIn-App',
          Accept: 'application/json',
          ...headers,
        },
      };
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk: string) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error('Invalid JSON response'));
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
  }

  async getStatus() {
    const [token, apiKey, workspaceId] = await Promise.all([
      this.settings.get('github_token'),
      this.settings.get('clickup_api_key'),
      this.settings.get('clickup_workspace_id'),
    ]);
    const [gitProjects, clickupProjects, gitCommitsCount, clickupTasksCount] =
      await Promise.all([
        this.prisma.project.count({
          where: { gitRepositoryUrl: { not: null } },
        }),
        this.prisma.project.count({
          where: { externalClickUpListId: { not: null } },
        }),
        this.prisma.gitCommit.count(),
        this.prisma.clickUpTaskLink.count(),
      ]);
    return {
      git: {
        configured: !!(token?.trim()),
        projectsConfigured: gitProjects,
        commitsSynced: gitCommitsCount,
      },
      clickup: {
        configured: !!(apiKey?.trim()),
        workspaceId: workspaceId ?? null,
        projectsConfigured: clickupProjects,
        tasksSynced: clickupTasksCount,
      },
    };
  }

  async syncGitCommits(
    projectId?: string,
  ): Promise<{ synced: number; skipped: number; errors: string[] }> {
    const token = await this.settings.get('github_token');
    if (!token?.trim())
      throw new BadRequestException('GitHub token not configured');

    const where = projectId
      ? { id: projectId, gitRepositoryUrl: { not: null as null } }
      : { gitRepositoryUrl: { not: null as null } };

    const projects = await this.prisma.project.findMany({ where });
    let synced = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const project of projects) {
      try {
        const repoUrl = project.gitRepositoryUrl!;
        const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
        if (!match) {
          skipped++;
          errors.push(`Invalid GitHub URL for project: ${project.projectName}`);
          continue;
        }
        const [, owner, repo] = match;

        type GHCommit = {
          sha: string;
          commit: {
            message: string;
            author: { name: string; email: string; date: string };
          };
        };

        const commits = await this.fetchJson<GHCommit[] | { message: string }>(
          `https://api.github.com/repos/${owner}/${repo}/commits?per_page=50`,
          { Authorization: `Bearer ${token}` },
        );

        if (!Array.isArray(commits)) {
          const errMsg =
            (commits as { message?: string }).message ?? 'GitHub API error';
          errors.push(`${owner}/${repo}: ${errMsg}`);
          skipped++;
          continue;
        }

        for (const c of commits) {
          const user = await this.prisma.user.findFirst({
            where: { email: c.commit.author.email },
          });

          const taskMatch = c.commit.message.match(/#([a-zA-Z0-9_-]+)/);
          let linkedTaskId: string | null = null;
          if (taskMatch) {
            const task = await this.prisma.task.findFirst({
              where: {
                OR: [
                  { clickUpTaskId: taskMatch[1] },
                  { taskName: { contains: taskMatch[1] } },
                ],
              },
            });
            linkedTaskId = task?.id ?? null;
          }

          await this.prisma.gitCommit.upsert({
            where: { commitHash: c.sha },
            update: {
              linkedUserId: user?.id ?? null,
              linkedTaskId,
            },
            create: {
              commitHash: c.sha,
              repository: `${owner}/${repo}`,
              commitMessage: c.commit.message.slice(0, 500),
              authorEmail: c.commit.author.email,
              authorName: c.commit.author.name,
              commitDate: new Date(c.commit.author.date),
              linkedUserId: user?.id ?? null,
              linkedTaskId,
            },
          });
          synced++;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Project "${project.projectName}": ${msg}`);
        skipped++;
      }
    }

    return { synced, skipped, errors };
  }

  async getCommits(filters: {
    userId?: string;
    repository?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, filters.limit ?? 20);
    const where = {
      ...(filters.userId && { linkedUserId: filters.userId }),
      ...(filters.repository && {
        repository: { contains: filters.repository },
      }),
      ...(filters.from || filters.to
        ? {
            commitDate: {
              ...(filters.from && { gte: new Date(filters.from) }),
              ...(filters.to && { lte: new Date(filters.to) }),
            },
          }
        : {}),
    };

    const [commits, total] = await Promise.all([
      this.prisma.gitCommit.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          linkedUser: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { commitDate: 'desc' },
      }),
      this.prisma.gitCommit.count({ where }),
    ]);

    return {
      data: commits,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async linkCommitToEntry(commitHash: string, timeEntryId: string) {
    return this.prisma.gitCommit.update({
      where: { commitHash },
      data: { linkedTimeEntryId: timeEntryId },
    });
  }

  async syncClickUpTasks(
    projectId?: string,
  ): Promise<{ synced: number; skipped: number; errors: string[] }> {
    const apiKey = await this.settings.get('clickup_api_key');
    if (!apiKey?.trim())
      throw new BadRequestException('ClickUp API key not configured');

    const where = projectId
      ? { id: projectId, externalClickUpListId: { not: null as null } }
      : { externalClickUpListId: { not: null as null } };

    const projects = await this.prisma.project.findMany({ where });
    let synced = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const project of projects) {
      try {
        const listId = project.externalClickUpListId!;

        type CUTask = {
          id: string;
          name: string;
          description?: string;
          status: { status: string };
          time_estimate?: number;
          due_date?: string;
          assignees: Array<{ email: string }>;
        };

        const data = await this.fetchJson<{
          tasks?: CUTask[];
          err?: string;
        }>(
          `https://api.clickup.com/api/v2/list/${listId}/task?include_closed=true`,
          { Authorization: apiKey },
        );

        if (!data?.tasks) {
          errors.push(
            `ClickUp list ${listId}: ${data?.err ?? 'No tasks returned'}`,
          );
          skipped++;
          continue;
        }

        for (const t of data.tasks) {
          let assignedUserId: string | null = null;
          if (t.assignees?.[0]?.email) {
            const user = await this.prisma.user.findFirst({
              where: { email: t.assignees[0].email },
            });
            assignedUserId = user?.id ?? null;
          }

          await this.prisma.clickUpTaskLink.upsert({
            where: { clickUpTaskId: t.id },
            update: {
              taskName: t.name,
              description: t.description?.slice(0, 500) ?? null,
              status: t.status?.status ?? null,
              estimatedTime: t.time_estimate
                ? Math.round(t.time_estimate / 60000)
                : null,
              dueDate: t.due_date
                ? new Date(parseInt(t.due_date))
                : null,
              projectId: project.id,
              assignedUserId,
              lastSyncDate: new Date(),
            },
            create: {
              clickUpTaskId: t.id,
              taskName: t.name,
              description: t.description?.slice(0, 500) ?? null,
              status: t.status?.status ?? null,
              estimatedTime: t.time_estimate
                ? Math.round(t.time_estimate / 60000)
                : null,
              dueDate: t.due_date
                ? new Date(parseInt(t.due_date))
                : null,
              projectId: project.id,
              assignedUserId,
            },
          });
          synced++;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Project "${project.projectName}": ${msg}`);
        skipped++;
      }
    }

    return { synced, skipped, errors };
  }

  async getClickUpTasks(filters: {
    projectId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, filters.limit ?? 50);
    const where = {
      ...(filters.projectId && { projectId: filters.projectId }),
      ...(filters.search && {
        taskName: { contains: filters.search },
      }),
    };

    const [tasks, total] = await Promise.all([
      this.prisma.clickUpTaskLink.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: { project: { select: { id: true, projectName: true } } },
        orderBy: { lastSyncDate: 'desc' },
      }),
      this.prisma.clickUpTaskLink.count({ where }),
    ]);

    return {
      data: tasks,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
