import client from './client';
import type { Project, PaginatedResponse } from '../types';

export interface CreateProjectDto {
  projectName: string;
  description?: string;
  status?: string;
  managerId?: string;
  gitRepositoryUrl?: string;
  externalClickUpListId?: string;
}

export const projectsApi = {
  create: (dto: CreateProjectDto) =>
    client.post<Project>('/projects', dto),

  findAll: (params?: { page?: number; limit?: number }) =>
    client.get<PaginatedResponse<Project>>('/projects', { params }),

  findOne: (id: string) =>
    client.get<Project>(`/projects/${id}`),

  update: (id: string, dto: Partial<CreateProjectDto>) =>
    client.patch<Project>(`/projects/${id}`, dto),

  archive: (id: string) =>
    client.patch<Project>(`/projects/${id}/archive`),
};
