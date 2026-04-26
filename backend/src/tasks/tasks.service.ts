import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { paginate, getSkip } from '../common/helpers/paginate.helper';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTaskDto, requester: AuthenticatedUser) {
    // MANAGER can only create tasks for their own projects
    if (requester.role === 'MANAGER') {
      const project = await this.prisma.project.findUnique({
        where: { id: dto.projectId },
      });
      if (!project || project.managerId !== requester.id) {
        throw new ForbiddenException(
          'You can only create tasks for your own projects',
        );
      }
    }
    return this.prisma.task.create({
      data: dto,
      include: {
        project: true,
        assignedUser: { select: { id: true, fullName: true } },
      },
    });
  }

  async findAll(
    requester: AuthenticatedUser,
    pagination: PaginationDto,
    projectId?: string,
    userId?: string,
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;

    // MANAGER sees only tasks in their projects
    let where: Record<string, unknown> = {
      ...(projectId && { projectId }),
      ...(userId && { assignedUserId: userId }),
    };

    if (requester.role === 'MANAGER') {
      const myProjects = await this.prisma.project.findMany({
        where: { managerId: requester.id },
        select: { id: true },
      });
      const myProjectIds = myProjects.map((p) => p.id);
      where = { ...where, projectId: { in: myProjectIds } };
    }

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip: getSkip(page, limit),
        take: limit,
        include: {
          project: { select: { id: true, projectName: true } },
          assignedUser: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.task.count({ where }),
    ]);

    return paginate(tasks, total, page, limit);
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        project: true,
        assignedUser: { select: { id: true, fullName: true } },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async update(
    id: string,
    dto: Partial<CreateTaskDto>,
    requester: AuthenticatedUser,
  ) {
    const task = await this.findOne(id);
    if (requester.role === 'MANAGER') {
      const project = await this.prisma.project.findUnique({
        where: { id: task.projectId },
      });
      if (!project || project.managerId !== requester.id) {
        throw new ForbiddenException(
          'You can only update tasks in your own projects',
        );
      }
    }
    return this.prisma.task.update({ where: { id }, data: dto });
  }

  async delete(id: string, requester: AuthenticatedUser) {
    const task = await this.findOne(id);
    if (requester.role === 'MANAGER') {
      const project = await this.prisma.project.findUnique({
        where: { id: task.projectId },
      });
      if (!project || project.managerId !== requester.id) {
        throw new ForbiddenException(
          'You can only delete tasks in your own projects',
        );
      }
    }
    return this.prisma.task.delete({ where: { id } });
  }
}
