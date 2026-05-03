import { Module } from '@nestjs/common';
import { TimeEntriesService } from './time-entries.service';
import { TimeEntriesController } from './time-entries.controller';
import { SettingsModule } from '../settings/settings.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [SettingsModule, NotificationsModule],
  providers: [TimeEntriesService],
  controllers: [TimeEntriesController],
})
export class TimeEntriesModule {}
