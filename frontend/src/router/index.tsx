import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
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
import type { Role } from '../types';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireRole({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles: Role[];
}) {
  const user = useAuthStore((s) => s.user);
  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

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
          <RequireRole roles={['MANAGER', 'ADMIN']}>
            <Projects />
          </RequireRole>
        ),
      },
      {
        path: 'tasks',
        element: (
          <RequireRole roles={['MANAGER', 'ADMIN']}>
            <Tasks />
          </RequireRole>
        ),
      },
      {
        path: 'users',
        element: (
          <RequireRole roles={['ADMIN']}>
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
