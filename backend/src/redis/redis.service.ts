import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private memStore = new Map<string, { value: string; expiresAt: number }>();

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const host = this.config.get<string>('REDIS_HOST', '127.0.0.1');
    const port = this.config.get<number>('REDIS_PORT', 6379);

    this.client = new Redis({
      host,
      port,
      lazyConnect: true,
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });

    this.client.on('connect', () => this.logger.log('Redis connected'));
    this.client.on('error', () => {
      if (this.client) {
        this.client.disconnect();
        this.client = null;
        this.logger.warn('Redis unavailable — using in-memory fallback (dev only)');
      }
    });

    this.client.connect().catch(() => {
      this.client = null;
      this.logger.warn('Redis unavailable — using in-memory fallback (dev only)');
    });
  }

  async onModuleDestroy() {
    if (this.client) await this.client.quit();
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (this.client) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      this.memStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.client) return this.client.get(key);
    const entry = this.memStore.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { this.memStore.delete(key); return null; }
    return entry.value;
  }

  async del(key: string): Promise<void> {
    if (this.client) await this.client.del(key);
    else this.memStore.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    if (this.client) return (await this.client.exists(key)) === 1;
    const entry = this.memStore.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) { this.memStore.delete(key); return false; }
    return true;
  }
}
