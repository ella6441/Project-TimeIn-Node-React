import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import TimeEntries from '../pages/TimeEntries';
import Projects from '../pages/Projects';
import Tasks from '../pages/Tasks';
import Users from '../pages/Users';
import Reports from '../pages/Reports';
import Settings from '../pages/Settings';
import Integrations from '../pages/Integrations';
import { RequireAuth, RequireRole } from './guards';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'time-entries', element: <TimeEntries /> },
      {
        path: 'projects',
        element: (
          <RequireRole roles={['EMPLOYEE', 'MANAGER', 'ADMIN']}>
            <Projects />
          </RequireRole>
        ),
      },
      {
        path: 'tasks',
        element: (
          <RequireRole roles={['EMPLOYEE', 'MANAGER', 'ADMIN']}>
            <Tasks />
          </RequireRole>
        ),
      },
      {
        path: 'users',
        element: (
          <RequireRole roles={['ADMIN', 'MANAGER']}>
            <Users />
          </RequireRole>
        ),
      },
      {
        path: 'reports',
        element: (
          <RequireRole roles={['MANAGER', 'ADMIN']}>
            <Reports />
          </RequireRole>
        ),
      },
      {
        path: 'settings',
        element: (
          <RequireRole roles={['ADMIN']}>
            <Settings />
          </RequireRole>
        ),
      },
      {
        path: 'integrations',
        element: (
          <RequireRole roles={['ADMIN']}>
            <Integrations />
          </RequireRole>
        ),
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
