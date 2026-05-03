import client from './client';
import type { Notification } from '../types';

export const notificationsApi = {
  findMine: (params?: { page?: number; limit?: number }) =>
    client.get<{ data: Notification[]; total: number }>('/notifications', { params }),

  countUnread: () =>
    client.get<{ count: number }>('/notifications/unread-count'),

  markRead: (id: string) =>
    client.patch(`/notifications/${id}/read`),

  markAllRead: () =>
    client.patch('/notifications/read-all'),

  sendReminders: (from: string, to: string) =>
    client.post<{ sent: number; employees: string[] }>('/notifications/remind', { from, to }),

  sendReminderToUser: (userId: string, date: string) =>
    client.post<{ sent: number; employee: string }>('/notifications/remind-user', { userId, date }),
};
