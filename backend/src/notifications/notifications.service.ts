import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { paginate, getSkip } from '../common/helpers/paginate.helper';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, title: string, body: string) {
    return this.prisma.notification.create({ data: { userId, title, body } });
  }

  async findMine(userId: string, pagination: PaginationDto) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        skip: getSkip(page, limit),
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);
    return paginate(notifications, total, page, limit);
  }

  async countUnread(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  async markRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }

  async sendReminders(from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setUTCHours(23, 59, 59, 999);

    const employees = await this.prisma.user.findMany({
      where: { isActive: true, role: 'EMPLOYEE' },
      select: { id: true, fullName: true },
    });

    const withEntries = await this.prisma.timeEntry.findMany({
      where: { date: { gte: fromDate, lte: toDate } },
      select: { userId: true },
      distinct: ['userId'],
    });
    const withEntryIds = new Set(withEntries.map((e) => e.userId));

    const toRemind = employees.filter((e) => !withEntryIds.has(e.id));

    await Promise.all(
      toRemind.map((e) =>
        this.prisma.notification.create({
          data: {
            userId: e.id,
            title: 'תזכורת: דיווח שעות',
            body: `לא נמצאו דיווחי שעות בתקופה ${from} עד ${to}. אנא דווח שעות בהקדם.`,
          },
        }),
      ),
    );

    return { sent: toRemind.length, employees: toRemind.map((e) => e.fullName) };
  }

  async sendReminderToUser(userId: string, date: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });
    if (!user) return { sent: 0 };
    await this.prisma.notification.create({
      data: {
        userId,
        title: 'תזכורת: דיווח שעות',
        body: `לא נמצא דיווח שעות לתאריך ${date}. אנא דווח שעות בהקדם.`,
      },
    });
    return { sent: 1, employee: user.fullName };
  }
}
