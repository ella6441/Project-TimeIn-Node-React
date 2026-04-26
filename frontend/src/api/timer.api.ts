import client from './client';
import type { TimerState } from '../types';

export const timerApi = {
  getState: () => client.get<TimerState | null>('/timer/status'),

  start: (data: { projectId: string; taskId: string; description?: string }) =>
    client.post<TimerState>('/timer/start', data),

  pause: () => client.post<TimerState>('/timer/pause'),

  resume: () => client.post<TimerState>('/timer/resume'),

  stop: () => client.post('/timer/stop'),

  discard: () => client.delete('/timer/discard'),
};
