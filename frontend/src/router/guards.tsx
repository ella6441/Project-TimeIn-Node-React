import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import type { Role } from '../types';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RequireRole({
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
