import client from './client';
import type { TimeEntry, PaginatedResponse, HoursSummary } from '../types';

export interface CreateTimeEntryDto {
  projectId: string;
  taskId: string;
  date: string;
  startTime: string;
  endTime: string;
  workType?: string;
  description?: string;
  relatedCommitHash?: string;
  relatedClickUpTaskId?: string;
}

export interface TimeEntryFilters {
  projectId?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface AllEntriesFilters extends TimeEntryFilters {
  userId?: string;
  taskId?: string;
}

export const timeEntriesApi = {
  create: (dto: CreateTimeEntryDto) =>
    client.post<TimeEntry>('/time-entries', dto),

  findMine: (filters?: TimeEntryFilters) =>
    client.get<PaginatedResponse<TimeEntry>>('/time-entries/mine', { params: filters }),

  getSummary: () =>
    client.get<HoursSummary>('/time-entries/summary'),

  getMyBreakdown: (params?: { from?: string; to?: string }) =>
    client.get('/time-entries/my-breakdown', { params }),

  findAll: (filters?: AllEntriesFilters) =>
    client.get<PaginatedResponse<TimeEntry>>('/time-entries', { params: filters }),

  update: (id: string, dto: Partial<CreateTimeEntryDto>) =>
    client.patch<TimeEntry>(`/time-entries/${id}`, dto),

  submit: (id: string) =>
    client.patch<TimeEntry>(`/time-entries/${id}/submit`),

  approve: (id: string) =>
    client.patch<TimeEntry>(`/time-entries/${id}/approve`),

  reject: (id: string) =>
    client.patch<TimeEntry>(`/time-entries/${id}/reject`),

  copy: (id: string) =>
    client.post<TimeEntry>(`/time-entries/${id}/copy`),

  delete: (id: string) =>
    client.delete(`/time-entries/${id}`),
};
