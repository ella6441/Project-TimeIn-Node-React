export type AuthenticatedUser = {
  id: string;
  fullName: string;
  email: string;
  role: 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
  team: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  password: string;
};
