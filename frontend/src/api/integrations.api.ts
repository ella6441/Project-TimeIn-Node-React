import client from './client';

export interface GitCommit {
  id: string;
  commitHash: string;
  repository: string;
  branch: string | null;
  commitMessage: string;
  authorEmail: string;
  authorName: string;
  commitDate: string;
  linkedUserId: string | null;
  linkedTaskId: string | null;
  linkedTimeEntryId: string | null;
  linkedUser: { id: string; fullName: string; email: string } | null;
  createdAt: string;
}

export interface ClickUpTask {
  id: string;
  clickUpTaskId: string;
  taskName: string;
  description: string | null;
  projectId: string | null;
  assignedUserId: string | null;
  status: string | null;
  estimatedTime: number | null;
  dueDate: string | null;
  lastSyncDate: string;
  project: { id: string; projectName: string } | null;
}

export interface IntegrationStatus {
  git: { configured: boolean; projectsConfigured: number; commitsSynced: number };
  clickup: { configured: boolean; workspaceId: string | null; projectsConfigured: number; tasksSynced: number };
}

export interface SyncResult {
  synced: number;
  skipped: number;
  errors: string[];
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const integrationsApi = {
  getStatus: () => client.get<IntegrationStatus>('/integrations/status'),

  syncGit: (projectId?: string) =>
    client.post<SyncResult>('/integrations/git/sync', {}, { params: projectId ? { projectId } : {} }),

  getCommits: (params?: {
    userId?: string;
    repository?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) => client.get<PaginatedResult<GitCommit>>('/integrations/git/commits', { params }),

  linkCommit: (commitHash: string, timeEntryId: string) =>
    client.post('/integrations/git/link', { commitHash, timeEntryId }),

  syncClickUp: (projectId?: string) =>
    client.post<SyncResult>('/integrations/clickup/sync', {}, { params: projectId ? { projectId } : {} }),

  getClickUpTasks: (params?: {
    projectId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => client.get<PaginatedResult<ClickUpTask>>('/integrations/clickup/tasks', { params }),
};
