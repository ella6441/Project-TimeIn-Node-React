import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { LoginDto } from './dto/login.dto';

const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 30; // 30 days in seconds

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private redis: RedisService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !user.isActive)
      throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const [accessToken, refreshToken] = await this.generateTokens(
      user.id,
      user.email,
      user.role,
    );
    await this.saveRefreshToken(user.id, refreshToken);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        team: user.team,
      },
    };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string };
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>('REFRESH_TOKEN_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.isActive)
      throw new UnauthorizedException('Invalid refresh token');

    const stored = await this.redis.get(this.refreshKey(user.id));
    if (!stored)
      throw new UnauthorizedException('Session expired, please login again');

    const tokenMatches = await bcrypt.compare(refreshToken, stored);
    if (!tokenMatches) throw new UnauthorizedException('Invalid refresh token');

    const [accessToken, newRefreshToken] = await this.generateTokens(
      user.id,
      user.email,
      user.role,
    );
    await this.saveRefreshToken(user.id, newRefreshToken);

    return { access_token: accessToken, refresh_token: newRefreshToken };
  }

  async logout(userId: string) {
    await this.redis.del(this.refreshKey(userId));
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, email: true, role: true, team: true },
    });
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
  ): Promise<[string, string]> {
    return Promise.all([
      this.jwt.signAsync({ sub: userId, email, role }, { expiresIn: '2h' }),
      this.jwt.signAsync(
        { sub: userId },
        {
          secret: this.config.get<string>('REFRESH_TOKEN_SECRET'),
          expiresIn: '30d',
        },
      ),
    ]);
  }

  private async saveRefreshToken(userId: string, refreshToken: string) {
    const hashed = await bcrypt.hash(refreshToken, 10);
    await this.redis.set(this.refreshKey(userId), hashed, REFRESH_TOKEN_TTL);
  }

  private refreshKey(userId: string): string {
    return `refresh_token:${userId}`;
  }
}
