import client from './client';
import type { User, PaginatedResponse } from '../types';

export interface CreateUserDto {
  email: string;
  password: string;
  fullName: string;
  role: string;
  team?: string;
}

export interface UpdateUserDto {
  fullName?: string;
  role?: string;
  team?: string;
  isActive?: boolean;
}

export const usersApi = {
  create: (dto: CreateUserDto) =>
    client.post<User>('/users', dto),

  findAll: (params?: { page?: number; limit?: number }) =>
    client.get<PaginatedResponse<User>>('/users', { params }),

  findOne: (id: string) =>
    client.get<User>(`/users/${id}`),

  update: (id: string, dto: UpdateUserDto) =>
    client.patch<User>(`/users/${id}`, dto),

  deactivate: (id: string) =>
    client.patch<User>(`/users/${id}/deactivate`),
};
