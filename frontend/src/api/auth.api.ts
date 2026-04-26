import client from './client';
import type { AuthUser } from '../types';

export const authApi = {
  login: (email: string, password: string) =>
    client.post<{ access_token: string; refresh_token: string; user: AuthUser }>(
      '/auth/login',
      { email, password },
    ),

  logout: () => client.post('/auth/logout'),

  getProfile: () => client.get<AuthUser>('/auth/profile'),
};
