import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma';
import { PrismaMssql } from '@prisma/adapter-mssql';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const factory = new PrismaMssql({
      server: process.env.DB_SERVER ?? 'ELLACOMPUTER',
      database: process.env.DB_NAME ?? 'timein',
      user: process.env.DB_USER ?? 'timein_user',
      password: process.env.DB_PASSWORD ?? 'TimeIn@2026!',
      options: { trustServerCertificate: true },
    });

    super({ adapter: factory });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
