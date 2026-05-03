import client from './client';
import type { Task, PaginatedResponse } from '../types';

export interface CreateTaskDto {
  taskName: string;
  description?: string;
  projectId: string;
  estimatedHours?: number;
  status?: string;
  priority?: string;
  assignedUserId?: string;
  clickUpTaskId?: string;
}

export const tasksApi = {
  create: (dto: CreateTaskDto) =>
    client.post<Task>('/tasks', dto),

  findAll: (params?: { projectId?: string; userId?: string; page?: number; limit?: number }) =>
    client.get<PaginatedResponse<Task>>('/tasks', { params }),

  findOne: (id: string) =>
    client.get<Task>(`/tasks/${id}`),

  update: (id: string, dto: Partial<CreateTaskDto>) =>
    client.patch<Task>(`/tasks/${id}`, dto),

  delete: (id: string) =>
    client.delete(`/tasks/${id}`),
};
