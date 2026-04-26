import client from './client';

export interface ReportFilters {
  from?: string;
  to?: string;
  userId?: string;
  projectId?: string;
}

export const reportsApi = {
  byEmployee: (filters?: ReportFilters) =>
    client.get('/reports/by-employee', { params: filters }),

  byProject: (filters?: ReportFilters) =>
    client.get('/reports/by-project', { params: filters }),

  byTask: (filters?: ReportFilters) =>
    client.get('/reports/by-task', { params: filters }),

  daily: (filters?: ReportFilters) =>
    client.get('/reports/daily', { params: filters }),

  anomalies: (filters?: ReportFilters) =>
    client.get('/reports/anomalies', { params: filters }),
};
