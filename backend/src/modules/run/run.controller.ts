
import { PrismaService } from '../prisma/prisma.service';

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RunService } from './run.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthRequest {
  user: { userId: string };
}

@Controller('api/run')
@UseGuards(JwtAuthGuard)
export class RunController {
  constructor(private readonly runService: RunService) {}

  // POST /api/run/start
  @Post('start')
  startRun(@Req() req: AuthRequest) {
    return this.runService.startRun(req.user.userId);
  }

  @Get(':runId/skills')
  async getAllSkills(
    @Param('runId') runId: string,
    @Req() req: AuthRequest,
  ) {
    const skills = await this.runService.getAllSkills(runId, req.user.userId);
    return skills;
  }

  // POST /api/run/:runId/owner/select
  @Post(':runId/owner/select')
  selectOwner(
    @Param('runId') runId: string,
    @Req() req: AuthRequest,
    @Body() body: Parameters<RunService['selectOwner']>[2],
  ) {
    return this.runService.selectOwner(runId, req.user.userId, body);
  }

  // GET /api/run/:runId/map/:floor
  @Get(':runId/map/:floor')
  getMap(
    @Param('runId') runId: string,
    @Param('floor') floor: string,
    @Req() req: AuthRequest,
  ) {
    return this.runService.getFloorMap(runId, req.user.userId, parseInt(floor, 10));
  }

  // POST /api/run/:runId/room/:roomId/enter
  @Post(':runId/room/:roomId/enter')
  enterRoom(
    @Param('runId') runId: string,
    @Param('roomId') roomId: string,
    @Req() req: AuthRequest,
  ) {
    return this.runService.enterRoom(runId, req.user.userId, roomId);
  }

  // POST /api/run/:runId/room/:roomId/turn
  @Post(':runId/room/:roomId/turn')
  processTurn(
    @Param('runId') runId: string,
    @Param('roomId') roomId: string,
    @Req() req: AuthRequest,
    @Body()
    body: {
      skillId: string;
      magicSwordAction?: 'force' | 'retry';
      forceActionType?: 'attack' | 'defend' | 'skill';
      enemyState: {
        id: string;
        hp: number;
        hpMax: number;
        atk: number;
        def: number;
        spd: number;
        statusEffects: unknown[];
        patterns: unknown[];
      };
    },
  ) {
    return this.runService.processTurn(runId, req.user.userId, roomId, body);
  }

  // POST /api/run/:runId/absorb
  @Post(':runId/absorb')
  absorbItem(
    @Param('runId') runId: string,
    @Req() req: AuthRequest,
    @Body() body: { itemId: string },
  ) {
    return this.runService.absorbItem(runId, req.user.userId, body.itemId);
  }

  // POST /api/run/:runId/end
  @Post(':runId/end')
  endRun(@Param('runId') runId: string, @Req() req: AuthRequest) {
    return this.runService.endRun(runId, req.user.userId);
  }

  // POST /api/run/:runId/trait/select
  @Post(':runId/trait/select')
  selectTrait(
    @Param('runId') runId: string,
    @Req() req: AuthRequest,
    @Body() body: { traitId: string },
  ) {
    return this.runService.selectTrait(runId, req.user.userId, body.traitId);
  }
}
