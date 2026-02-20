import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

interface AuthRequest {
  user: { userId: string };
}

@Controller('api/codex')
@UseGuards(JwtAuthGuard)
export class CodexController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('traits')
  async getTraits(@Req() req: AuthRequest) {
    return this.prisma.permanentTraitProgress.findMany({
      where: { userId: req.user.userId },
    });
  }

  @Get('runs')
  async getRuns(@Req() req: AuthRequest) {
    const runs = await this.prisma.run.findMany({
      where: { userId: req.user.userId },
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: { ownerState: { select: { class: true, name: true } }, swordState: { select: { element: true } } },
    });

    return runs.map(r => ({
      id: r.id,
      status: r.status,
      floorDepth: r.floorDepth,
      killedBy: r.killedBy,
      bossReached: r.bossReached,
      ownerClass: r.ownerState?.class,
      ownerName: r.ownerState?.name,
      swordElement: r.swordState?.element,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
    }));
  }

  @Get('runs/:runId')
  async getRunDetail(@Param('runId') runId: string, @Req() req: AuthRequest) {
    const run = await this.prisma.run.findFirst({
      where: { id: runId, userId: req.user.userId },
      include: {
        ownerState: true,
        swordState: true,
        traitCandidates: true,
        turnLogs: { orderBy: { turnNumber: 'asc' }, take: 100 },
      },
    });

    if (!run) return { error: 'Not found' };
    return run;
  }
}
