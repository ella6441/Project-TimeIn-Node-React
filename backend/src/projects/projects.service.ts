import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { paginate, getSkip } from '../common/helpers/paginate.helper';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateProjectDto, requester: AuthenticatedUser) {
    // MANAGER can only create projects for their own team
    if (requester.role === 'MANAGER') {
      return this.prisma.project.create({
        data: { ...dto, managerId: requester.id },
      });
    }
    return this.prisma.project.create({ data: dto });
  }

  async findAll(requester: AuthenticatedUser, pagination: PaginationDto) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;

    // MANAGER sees only projects they manage; EMPLOYEE sees only their manager's projects
    let where: { managerId?: string } = {};
    if (requester.role === 'MANAGER') {
      where = { managerId: requester.id };
    } else if (requester.role === 'EMPLOYEE' && requester.managerId) {
      where = { managerId: requester.managerId as string };
    }

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip: getSkip(page, limit),
        take: limit,
        include: { manager: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.project.count({ where }),
    ]);

    return paginate(projects, total, page, limit);
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        manager: { select: { id: true, fullName: true } },
        tasks: true,
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async update(
    id: string,
    dto: Partial<CreateProjectDto>,
    requester: AuthenticatedUser,
  ) {
    const project = await this.findOne(id);
    if (requester.role === 'MANAGER' && project.managerId !== requester.id) {
      throw new ForbiddenException('You can only update your own projects');
    }
    return this.prisma.project.update({ where: { id }, data: dto });
  }

  async archive(id: string, requester: AuthenticatedUser) {
    const project = await this.findOne(id);
    if (requester.role === 'MANAGER' && project.managerId !== requester.id) {
      throw new ForbiddenException('You can only archive your own projects');
    }
    return this.prisma.project.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
  }
}
