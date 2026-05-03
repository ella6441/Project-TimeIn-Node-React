import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingDto } from './dto/update-setting.dto';

const DEFAULTS: Record<string, string> = {
  allow_retroactive: 'true',
  max_retroactive_days: '30',
  max_daily_hours: '10',
  require_description: 'false',
  require_work_type: 'false',
  work_types: 'DEVELOPMENT,DESIGN,MEETINGS,REVIEW,TESTING,OTHER',
  task_statuses: 'TODO,IN_PROGRESS,DONE,CANCELLED',
};

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    for (const [key, value] of Object.entries(DEFAULTS)) {
      await this.prisma.systemSetting.upsert({
        where: { key },
        update: {},
        create: { key, value },
      });
    }
  }

  async findAll() {
    return this.prisma.systemSetting.findMany();
  }

  async update(key: string, dto: UpdateSettingDto) {
    return this.prisma.systemSetting.upsert({
      where: { key },
      update: { value: dto.value },
      create: { key, value: dto.value },
    });
  }

  async get(key: string): Promise<string | null> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key },
    });
    return setting?.value ?? DEFAULTS[key] ?? null;
  }
}
