import { SetMetadata } from '@nestjs/common';

export type Role = 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
