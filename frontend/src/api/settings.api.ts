import client from './client';

export const settingsApi = {
  findAll: () =>
    client.get<{ key: string; value: string }[]>('/settings'),

  update: (key: string, value: string) =>
    client.patch(`/settings/${key}`, { value }),
};
