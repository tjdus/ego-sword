import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { createHash, randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * 게스트 토큰 발급 또는 기존 유저 복원
   */
  async guestLogin(deviceId?: string): Promise<{ userId: string; token: string }> {
    const guestToken = randomBytes(16).toString('hex');

    // deviceId로 기존 유저 찾기
    let user = deviceId
      ? await this.prisma.user.findFirst({ where: { deviceId } })
      : null;

    if (!user) {
      user = await this.prisma.user.create({
        data: { guestToken, deviceId },
      });
    }

    const token = this.jwt.sign({ sub: user.id, guestToken: user.guestToken });
    return { userId: user.id, token };
  }

  /**
   * 유저 진행 현황 조회
   */
  async getProgress(userId: string) {
    const [user, runs] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        include: { permanentTraits: true },
      }),
      this.prisma.run.findMany({
        where: { userId },
        orderBy: { startedAt: 'desc' },
        take: 10,
        include: { ownerState: true },
      }),
    ]);

    const bestDepth = runs.reduce((max, r) => Math.max(max, r.floorDepth), 0);
    const totalRuns = runs.length;

    return {
      permanentTraits: user?.permanentTraits ?? [],
      totalRuns,
      bestDepth,
      recentRuns: runs.map(r => ({
        id: r.id,
        status: r.status,
        floorDepth: r.floorDepth,
        killedBy: r.killedBy,
        ownerClass: r.ownerState?.class,
        startedAt: r.startedAt,
      })),
    };
  }

  validateToken(token: string): { sub: string } {
    return this.jwt.verify(token);
  }
}
