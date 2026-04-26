export type Role = 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
export type WorkType = 'DEVELOPMENT' | 'DESIGN' | 'MEETINGS' | 'REVIEW' | 'TESTING' | 'OTHER';
export type EntryStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
export type EntrySource = 'MANUAL' | 'TIMER' | 'IMPORT';
export type ProjectStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
export type TimerStatus = 'RUNNING' | 'PAUSED';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  team: string | null;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  team: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface Project {
  id: string;
  projectName: string;
  description: string | null;
  status: ProjectStatus;
  managerId: string | null;
  manager?: { id: string; fullName: string };
  gitRepositoryUrl: string | null;
  externalClickUpListId: string | null;
  createdAt: string;
}

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Task {
  id: string;
  taskName: string;
  description: string | null;
  projectId: string;
  project?: { id: string; projectName: string };
  estimatedHours: number | null;
  status: TaskStatus;
  priority: TaskPriority | null;
  assignedUserId: string | null;
  assignedUser?: { id: string; fullName: string };
  clickUpTaskId: string | null;
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  userId: string;
  user?: { id: string; fullName: string };
  projectId: string;
  project?: { id: string; projectName: string };
  taskId: string;
  task?: { id: string; taskName: string };
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  workType: WorkType;
  description: string | null;
  status: EntryStatus;
  source: EntrySource;
  relatedCommitHash: string | null;
  relatedClickUpTaskId: string | null;
  createdAt: string;
}

export interface TimerState {
  projectId: string;
  taskId: string;
  description: string | null;
  startTime: string;
  pausedAt: string | null;
  totalPausedMs: number;
  status: TimerStatus;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface HoursSummary {
  todayMinutes: number;
  weekMinutes: number;
  monthMinutes: number;
}
