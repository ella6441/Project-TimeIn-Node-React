import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { TimeEntriesModule } from './time-entries/time-entries.module';
import { ReportsModule } from './reports/reports.module';
import { TimerModule } from './timer/timer.module';
import { SettingsModule } from './settings/settings.module';
import { RedisModule } from './redis/redis.module';
import { HttpLoggerMiddleware } from './common/middleware/http-logger.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      { name: 'global', ttl: 60000, limit: 100 }, // 100 בקשות לדקה — לכולם
      { name: 'auth', ttl: 60000, limit: 10 }, // 10 ניסיונות login לדקה
    ]),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    TasksModule,
    TimeEntriesModule,
    ReportsModule,
    TimerModule,
    SettingsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpLoggerMiddleware).forRoutes('*');
  }
}
