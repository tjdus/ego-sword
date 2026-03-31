import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { CompatibilityEngine } from '../../engine/compatibility.engine';
import {
  CombatEngine,
  BattleContext,
  SkillInput,
} from '../../engine/combat.engine';
import { MagicSwordEngine } from '../../engine/magic-sword.engine';
import { RewardEngine } from '../../engine/reward.engine';
import { TriggerEngine } from '../../engine/trigger.engine';
import { buildTagMap } from '../../engine/mutation';
import type {
  Element,
  OwnerClass,
  SwordStats,
  OwnerCombatStats,
  OwnerPersonalityStats,
  EnemyPattern,
  AppliedStatus,
} from '../../shared/types/game.types';
import {
  SWORD_DEFAULT_STATS,
  DUNGEON_FLOORS,
  ROOMS_PER_FLOOR,
  STRONG_OWNER_PROB_BY_FLOOR,
  OWNER_PERSONALITY_WEIGHTS,
  TRAIT_SOFTCAP_EFFECT_RATIO,
} from '../../shared/constants/game.constants';
import { createHash } from 'crypto';
import {
  AppliedStatusArraySchema,
  EnemyPatternArraySchema,
} from 'src/shared/types/zod.enemy';
import e from 'express';
import { Prisma } from '@prisma/client';

// 외형 변화 감지용 — ai.service.ts의 getSwordWeaponType 로직을 미러링
function computeSwordVisualKey(s: {
  element: string;
  tags: string[];
  dom: number;
  atk: number;
  def: number;
  spd: number;
  isMagicSword: boolean;
  isOverdriven: boolean;
}): string {
  const tc: Record<string, number> = {};
  for (const t of s.tags) tc[t] = (tc[t] ?? 0) + 1;

  let weapon: string;
  if ((tc['soul'] ?? 0) >= 2) weapon = 'spectral_halberd';
  else if ((tc['dark'] ?? 0) >= 3) weapon = 'dark_scythe';
  else if ((tc['thunder'] ?? 0) >= 2) weapon = 'lightning_spear';
  else if ((tc['curse'] ?? 0) >= 3) weapon = 'cursed_crossbow';
  else if ((tc['light'] ?? 0) >= 3) weapon = 'holy_lance';
  else if ((tc['combat'] ?? 0) >= 3) weapon = 'great_sword';
  else if (s.spd >= 22 && s.atk < 30) weapon = 'bow';
  else if (s.def >= 28) weapon = 'broad_sword';
  else if (s.atk >= 40) weapon = 'two_handed';
  else weapon = `elem_${s.element}${s.element === 'dark' && s.dom >= 5 ? '_dom5' : ''}`;

  return `${weapon}|${s.isMagicSword ? 'M' : ''}${s.isOverdriven ? 'O' : ''}`;
}

const ELEMENTS: Element[] = [
  'fire',
  'water',
  'ice',
  'thunder',
  'wind',
  'poison',
  'light',
  'dark',
  'neutral',
];
const CLASSES: OwnerClass[] = [
  'warrior',
  'mage',
  'paladin',
  'rogue',
  'hunter',
  'berserker',
];
const RARITIES = ['common', 'rare', 'epic'] as const;
type RarityType = (typeof RARITIES)[number];

// ─── 결정론적 랜덤 (시드 기반) ───────────────────────────────────────────────

function seededRandom(seed: string, index: number): number {
  const hash = createHash('sha256').update(`${seed}:${index}`).digest('hex');
  return parseInt(hash.slice(0, 8), 16) / 0xffffffff;
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

// ─── 주인 생성 ────────────────────────────────────────────────────────────────

function generateOwnerStats(
  ownerClass: OwnerClass,
  rarity: RarityType,
  floor: number,
  rng: (i: number) => number,
): { combat: OwnerCombatStats; personality: OwnerPersonalityStats } {
  const baseHp = 60 + floor * 15;
  const rarityMult = rarity === 'common' ? 1.0 : rarity === 'rare' ? 1.2 : 1.5;

  const combat: OwnerCombatStats = {
    hp: Math.round(baseHp * rarityMult + rng(0) * 10),
    hpMax: Math.round(baseHp * rarityMult + rng(0) * 10),
    pow: Math.round((8 + floor * 3) * rarityMult + rng(1) * 5),
    guard: Math.round((4 + floor * 2) * rarityMult + rng(2) * 4),
    agi: Math.round((6 + floor * 2) * rarityMult + rng(3) * 4),
    focus: Math.round((6 + floor * 2) * rarityMult + rng(4) * 4),
  };

  const weights = OWNER_PERSONALITY_WEIGHTS[ownerClass];
  const personality: OwnerPersonalityStats = {
    det: clamp(Math.round(weights.det + (rng(5) - 0.5) * 4), 0, 10),
    greed: clamp(Math.round(weights.greed + (rng(6) - 0.5) * 4), 0, 10),
    bold: clamp(Math.round(weights.bold + (rng(7) - 0.5) * 4), 0, 10),
    caut: clamp(Math.round(weights.caut + (rng(8) - 0.5) * 4), 0, 10),
    mercy: clamp(Math.round(weights.mercy + (rng(9) - 0.5) * 4), 0, 10),
  };

  return { combat, personality };
}

// ─── 맵 생성 ─────────────────────────────────────────────────────────────────

function generateDungeonMap(
  runId: string,
  dungeonSeed: string,
): { floor: number; position: number; roomType: string }[] {
  const rooms: { floor: number; position: number; roomType: string }[] = [];

  for (let floor = 1; floor <= DUNGEON_FLOORS; floor++) {
    for (let pos = 1; pos <= ROOMS_PER_FLOOR; pos++) {
      const rng = seededRandom(`${dungeonSeed}:${floor}:${pos}`, 0);
      let roomType: string;

      if (pos === ROOMS_PER_FLOOR) {
        roomType = floor === DUNGEON_FLOORS ? 'boss' : 'boss';
      } else if (pos === 1) {
        roomType = 'battle';
      } else {
        const r = rng;
        if (r < 0.4) roomType = 'battle';
        else if (r < 0.55) roomType = 'event';
        else if (r < 0.65) roomType = 'elite';
        else if (r < 0.75) roomType = 'shop';
        else if (r < 0.85) roomType = 'rest';
        else roomType = 'battle';
      }

      rooms.push({ floor, position: pos, roomType });
    }
  }

  return rooms;
}

// ─── 스킬 업그레이드 규칙 ─────────────────────────────────────────────────────

const SKILL_UPGRADE_RULES: Array<{
  tag: string;
  count: number;
  from: string;
  to: string;
}> = [
  { tag: 'curse', count: 3, from: 'SK_BASIC_SLASH', to: 'SK_CURSED_SLASH' },
  { tag: 'dark', count: 3, from: 'SK_FREEZE', to: 'SK_DARK_FREEZE' },
  { tag: 'combat', count: 3, from: 'SK_BASIC_SLASH', to: 'SK_BATTLE_CRY' },
  { tag: 'combat', count: 3, from: 'SK_SYNC_PULSE', to: 'SK_MULTI_STRIKE' },
];

function checkSkillUpgrades(
  tagMap: Record<string, number>,
  currentSkillIds: string[],
): { from: string; to: string }[] {
  const upgrades: { from: string; to: string }[] = [];
  for (const rule of SKILL_UPGRADE_RULES) {
    if (
      (tagMap[rule.tag] ?? 0) >= rule.count &&
      currentSkillIds.includes(rule.from) &&
      !currentSkillIds.includes(rule.to)
    ) {
      upgrades.push({ from: rule.from, to: rule.to });
    }
  }
  return upgrades;
}

@Injectable()
export class RunService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly compatEngine: CompatibilityEngine,
    private readonly combatEngine: CombatEngine,
    private readonly magicSwordEngine: MagicSwordEngine,
    private readonly rewardEngine: RewardEngine,
    private readonly triggerEngine: TriggerEngine,
  ) {}

  // ─── 런 시작 (주인 후보 3명 생성) ──────────────────────────────────────────

  async startRun(userId: string): Promise<{
    runId: string;
    ownerCandidates: unknown[];
  }> {
    // 기존 활성 런이 있으면 실패 처리
    const activeRun = await this.prisma.run.findFirst({
      where: { userId, status: 'active' },
    });
    if (activeRun) {
      await this.prisma.run.update({
        where: { id: activeRun.id },
        data: { status: 'failed', endedAt: new Date() },
      });
    }

    const dungeonSeed = createHash('sha256')
      .update(`${userId}:${Date.now()}`)
      .digest('hex')
      .slice(0, 16);

    const run = await this.prisma.run.create({
      data: { userId, dungeonSeed },
    });

    // 주인 후보 3명 생성 (비결정론적, 런마다 다름)
    const candidates = await this.generateOwnerCandidates(
      run.id,
      dungeonSeed,
      1,
      userId,
    );

    return { runId: run.id, ownerCandidates: candidates };
  }

  private async generateOwnerCandidates(
    runId: string,
    seed: string,
    floor: number,
    userId: string,
  ) {
    const candidates: Record<string, unknown>[] = [];
    const strongProb = STRONG_OWNER_PROB_BY_FLOOR[floor] ?? 0.1;

    for (let i = 0; i < 3; i++) {
      const rng = (idx: number) => seededRandom(`${seed}:candidate:${i}`, idx);
      const isStrong = rng(99) < strongProb;
      const rarity: RarityType = isStrong
        ? 'rare'
        : rng(98) < 0.15
          ? 'rare'
          : 'common';
      const ownerClass = CLASSES[Math.floor(rng(100 + i) * CLASSES.length)];
      const ownerElement = ELEMENTS[Math.floor(rng(200 + i) * ELEMENTS.length)];
      const swordElement: Element = 'neutral'; // 런 시작 시 기본 속성

      const { combat, personality } = generateOwnerStats(
        ownerClass,
        rarity,
        floor,
        (idx) => rng(idx),
      );

      const swordStats: SwordStats = { ...SWORD_DEFAULT_STATS };
      const compatBreakdown = this.compatEngine.calculate(
        ownerClass,
        ownerElement,
        swordElement,
        swordStats,
        combat,
        personality,
      );

      const aiText = await this.ai.generateOwnerText(
        {
          class: ownerClass,
          rarity,
          combatStats: combat as unknown as Record<string, number>,
          personalityStats: personality as unknown as Record<string, number>,
          ownerTraits: [],
          floorDepth: floor,
          swordElement,
          compatibilityScore: compatBreakdown.total,
        },
        userId,
        runId,
      );

      const ownerId = `${runId}:owner:${i}`;
      candidates.push({
        ownerId,
        class: ownerClass,
        rarity,
        element: ownerElement,
        combatStats: combat,
        personalityStats: personality,
        compatibilityScore: compatBreakdown.total,
        compatBreakdown,
        aiText: {
          name: aiText.name,
          oneLiner: aiText.oneLiner,
          speechStyle: aiText.speechStyle,
          combatBarks: aiText.combatBarks,
          exploreBarks: aiText.exploreBarks,
          backstory: aiText.backstory ?? null,
          swordOpinion: aiText.swordOpinion ?? null,
          uniqueQuirk: aiText.uniqueQuirk ?? null,
        },
        hint:
          compatBreakdown.total >= 70
            ? '전투 시너지 강함'
            : compatBreakdown.total >= 50
              ? '균형잡힌 조합'
              : '탐험 중심 조합',
      });
    }

    return candidates;
  }

  // ─── 주인 선택 확정 ──────────────────────────────────────────────────────

  async selectOwner(
    runId: string,
    userId: string,
    candidateData: {
      ownerId: string;
      class: string;
      rarity: string;
      element: string;
      combatStats: OwnerCombatStats;
      personalityStats: OwnerPersonalityStats;
      compatibilityScore: number;
      compatBreakdown: Record<string, number>;
      aiText: {
        name: string;
        oneLiner: string;
        speechStyleJson?: Record<string, string>;
        speechStyle?: { tone: string; quirk: string };
        backstory?: string | null;
        swordOpinion?: string | null;
        uniqueQuirk?: string | null;
      };
    },
  ) {
    const run = await this.prisma.run.findFirst({
      where: { id: runId, userId, status: 'active' },
    });
    if (!run) throw new NotFoundException('활성 런을 찾을 수 없습니다.');

    // 영구 특성에서 시작 DOM 보정 계산
    const domTrait = await this.prisma.permanentTraitProgress.findFirst({
      where: { userId, traitId: 'DOM_START' },
    });
    const startDom = Math.min(10, domTrait?.stacks ?? 0);

    // SwordState 초기화 (영구 특성 반영)
    const [swordState, ownerState] = await Promise.all([
      this.prisma.swordState.create({
        data: {
          runId,
          ...SWORD_DEFAULT_STATS,
          dom: startDom,
          element: 'neutral',
          isMagicSword: this.magicSwordEngine.isMagicSword(startDom),
          activeSkillIds: [
            'SK_BASIC_SLASH',
            'SK_SYNC_PULSE',
            'SK_ICE_SHIELD',
            'SK_FREEZE',
          ],
          passiveSkillIds: [],
          absorbedItemIds: [],
          tags: [],
          gold: 30,
        },
      }),
      this.prisma.ownerState.create({
        data: {
          runId,
          ownerId: candidateData.ownerId,
          class: candidateData.class,
          rarity: candidateData.rarity,
          hp: candidateData.combatStats.hp,
          hpMax: candidateData.combatStats.hpMax,
          pow: candidateData.combatStats.pow,
          guard: candidateData.combatStats.guard,
          agi: candidateData.combatStats.agi,
          focus: candidateData.combatStats.focus,
          det: candidateData.personalityStats.det,
          greed: candidateData.personalityStats.greed,
          bold: candidateData.personalityStats.bold,
          caut: candidateData.personalityStats.caut,
          mercy: candidateData.personalityStats.mercy,
          ownerTraitIds: [],
          name: candidateData.aiText.name,
          oneLiner: candidateData.aiText.oneLiner,
          speechStyleJson: (candidateData.aiText.speechStyleJson ??
            candidateData.aiText.speechStyle ??
            {}) as Record<string, string>,
          ownerExtendedJson: {
            backstory: candidateData.aiText.backstory ?? null,
            swordOpinion: candidateData.aiText.swordOpinion ?? null,
            uniqueQuirk: candidateData.aiText.uniqueQuirk ?? null,
          },
          compatibilityScore: candidateData.compatibilityScore,
          compatBreakdown: candidateData.compatBreakdown,
        },
      }),
    ]);

    // 맵 생성
    const mapRooms = generateDungeonMap(runId, run.dungeonSeed);
    await this.prisma.runRoom.createMany({
      data: mapRooms.map((r) => ({
        runId,
        floor: r.floor,
        position: r.position,
        roomType: r.roomType,
        status: r.floor === 1 && r.position === 1 ? 'available' : 'locked',
      })),
    });

    const firstFloorMap = await this.prisma.runRoom.findMany({
      where: { runId, floor: 1 },
      orderBy: { position: 'asc' },
    });

    return { runId, ownerState, swordState, firstFloorMap };
  }

  // ─── 맵 조회 ─────────────────────────────────────────────────────────────

  async getFloorMap(runId: string, userId: string, floor: number) {
    const run = await this.prisma.run.findFirst({
      where: { id: runId, userId },
    });
    if (!run) throw new NotFoundException('런을 찾을 수 없습니다.');

    return this.prisma.runRoom.findMany({
      where: { runId, floor },
      orderBy: { position: 'asc' },
    });
  }

  // ─── 방 진입 ─────────────────────────────────────────────────────────────

  async enterRoom(runId: string, userId: string, roomId: string) {
    const [run, room] = await Promise.all([
      this.prisma.run.findFirst({
        where: { id: runId, userId, status: 'active' },
      }),
      this.prisma.runRoom.findUnique({ where: { id: roomId } }),
    ]);

    if (!run) throw new NotFoundException('활성 런을 찾을 수 없습니다.');
    if (!room || room.runId !== runId)
      throw new NotFoundException('방을 찾을 수 없습니다.');
    if (room.status === 'locked')
      throw new BadRequestException('잠긴 방입니다.');

    console.log(room);

    if (
      room.roomType === 'battle' ||
      room.roomType === 'elite' ||
      room.roomType === 'boss'
    ) {
      // roomType('battle') → enemyCategory('normal') 매핑
      const enemyCategory =
        room.roomType === 'battle' ? 'normal' : room.roomType; // elite|boss는 동일
      const enemyTemplate = room.enemyId
        ? await this.prisma.enemyTemplate.findUnique({
            where: { id: room.enemyId },
          })
        : await this.getRandomEnemy(enemyCategory, run.currentFloor);

      if (!enemyTemplate)
        throw new NotFoundException('적 템플릿을 찾을 수 없습니다.');

      const enemyState = await this.prisma.enemyState.create({
        data: {
          runId,
          roomId,
          templateId: enemyTemplate.id,
          hp: enemyTemplate.hp,
          hpMax: enemyTemplate.hp,
          atk: enemyTemplate.atk,
          def: enemyTemplate.def,
          spd: enemyTemplate.spd,
          statusJson: [],
          patternStateJson: enemyTemplate.patternJson || [],
        },
      });

      if (enemyTemplate && !room.enemyId) {
        await this.prisma.runRoom.update({
          where: { id: roomId },
          data: {
            enemyId: enemyTemplate.id,
            enemyState: {
              connect: { id: enemyState.id },
            },
          },
        });
      }

      const [sword, owner] = await Promise.all([
        this.prisma.swordState.findUnique({ where: { runId } }),
        this.prisma.ownerState.findUnique({ where: { runId } }),
      ]);

      return {
        roomType: room.roomType,
        enemyState: enemyTemplate,
        swordState: sword,
        ownerState: owner,
      };
    }

    if (room.roomType === 'rest') {
      return { roomType: 'rest', action: 'heal_available' };
    }

    if (room.roomType === 'event') {
      // 이미 생성된 이벤트가 있으면 재사용 (캐시)
      if (room.aiEventJson) {
        return { roomType: 'event', eventData: room.aiEventJson };
      }

      // 검/주인 상태 로드 후 AI 이벤트 생성
      const [sword, owner] = await Promise.all([
        this.prisma.swordState.findUnique({ where: { runId } }),
        this.prisma.ownerState.findUnique({ where: { runId } }),
      ]);

      const eventData = await this.ai.generateEventData(
        {
          floor: run.currentFloor,
          ownerName: owner?.name ?? '이름 없음',
          ownerClass: owner?.class ?? 'warrior',
          ownerPersonality: {
            det: owner?.det ?? 5,
            greed: owner?.greed ?? 5,
            bold: owner?.bold ?? 5,
            caut: owner?.caut ?? 5,
            mercy: owner?.mercy ?? 5,
          },
          swordElement: sword?.element ?? 'neutral',
          swordTags: sword?.tags ?? [],
          compatScore: owner?.compatibilityScore ?? 50,
          dom: sword?.dom ?? 0,
          stb: sword?.stb ?? 10,
        },
        runId,
        roomId,
      );

      // DB에 저장 (재방문 시 동일 이벤트)
      await this.prisma.runRoom.update({
        where: { id: roomId },
        data: { aiEventJson: eventData as unknown as Prisma.JsonObject },
      });

      return { roomType: 'event', eventData };
    }

    return { roomType: room.roomType };
  }

  private async getRandomEnemy(category: string, floor: number) {
    const enemies = await this.prisma.enemyTemplate.findMany({
      where: { category, floorMin: { lte: floor }, floorMax: { gte: floor } },
    });
    if (enemies.length === 0) return null;
    return enemies[Math.floor(Math.random() * enemies.length)];
  }

  // ─── 전투 턴 처리 ────────────────────────────────────────────────────────

  async processTurn(
    runId: string,
    userId: string,
    roomId: string,
    body: {
      skillId: string;
      magicSwordAction?: 'force' | 'retry';
      forceActionType?: 'attack' | 'defend' | 'skill';
    },
  ) {
    const [run, room, swordDb, ownerDb, enemyDB] = await Promise.all([
      this.prisma.run.findFirst({
        where: { id: runId, userId, status: 'active' },
      }),
      this.prisma.runRoom.findUnique({ where: { id: roomId } }),
      this.prisma.swordState.findUnique({ where: { runId } }),
      this.prisma.ownerState.findUnique({ where: { runId } }),
      this.prisma.enemyState.findUnique({
        where: { roomId },
        include: { template: true },
      }),
    ]);

    if (!run || !room || !swordDb || !ownerDb || !enemyDB)
      throw new NotFoundException('게임 상태를 찾을 수 없습니다.');

    // 스킬 템플릿 조회 (서버 권위 비용 검증)
    const skill = await this.prisma.skillTemplate.findUnique({
      where: { id: body.skillId },
    });
    if (!skill) throw new BadRequestException('유효하지 않은 스킬입니다.');

    const turnCount = await this.prisma.runTurnLog.count({
      where: { runId, roomId },
    });

    const swordStats: SwordStats = {
      atk: swordDb.atk,
      def: swordDb.def,
      spd: swordDb.spd,
      sync: swordDb.sync,
      syncMax: swordDb.syncMax,
      stb: swordDb.stb,
      dom: swordDb.dom,
    };

    const ownerCombat: OwnerCombatStats = {
      hp: ownerDb.hp,
      hpMax: ownerDb.hpMax,
      pow: ownerDb.pow,
      guard: ownerDb.guard,
      agi: ownerDb.agi,
      focus: ownerDb.focus,
    };

    const ownerPersonality: OwnerPersonalityStats = {
      det: ownerDb.det,
      greed: ownerDb.greed,
      bold: ownerDb.bold,
      caut: ownerDb.caut,
      mercy: ownerDb.mercy,
    };

    const ctx: BattleContext = {
      turnNumber: turnCount + 1,
      sword: {
        ...swordStats,
        element: swordDb.element as Element,
        activeSkillIds: swordDb.activeSkillIds,
        tags: swordDb.tags,
        statusEffects: [],
        isOverdriven: swordDb.isOverdriven,
        isMagicSword: swordDb.isMagicSword,
      },
      owner: {
        ...ownerCombat,
        class: ownerDb.class as OwnerClass,
        personalityStats: ownerPersonality,
        statusEffects: [],
        misjudgeChance: 0,
      },
      enemy: {
        ...enemyDB,
        name: enemyDB.template.name,
        element: enemyDB.template.element as Element,
        patterns: EnemyPatternArraySchema.parse(enemyDB.template.patternJson),
        statusEffects: AppliedStatusArraySchema.parse(enemyDB.statusJson),
      },
      compatibilityScore: ownerDb.compatibilityScore,
      ownerElement: 'neutral' as Element,
    };

    const skillInput: SkillInput = {
      skillId: skill.id,
      aiName: skill.aiName ?? skill.id,
      effect:
        skill.effectJson as import('../../shared/types/game.types').SkillEffect,
      risk: skill.riskJson as
        | import('../../shared/types/game.types').SkillRisk
        | undefined,
      element: skill.element as Element,
      cost: skill.cost,
      magicSwordAction: body.magicSwordAction,
      forceActionType: body.forceActionType,
    };

    const result = this.combatEngine.executeTurn(ctx, skillInput);

    // DB 업데이트 (서버 권위)
    await Promise.all([
      this.prisma.swordState.update({
        where: { runId },
        data: {
          sync: result.swordStateAfter.sync ?? swordStats.sync,
          stb: result.swordStateAfter.stb ?? swordStats.stb,
          dom: result.swordStateAfter.dom ?? swordStats.dom,
          atk: result.swordStateAfter.atk ?? swordStats.atk,
          def: result.swordStateAfter.def ?? swordStats.def,
          spd: result.swordStateAfter.spd ?? swordStats.spd,
          isOverdriven: result.swordStateAfter.isOverdriven ?? false,
          isMagicSword: result.swordStateAfter.isMagicSword ?? false,
        },
      }),
      this.prisma.ownerState.update({
        where: { runId },
        // Prisma v6 strict mode: undefined를 넘기면 "missing" 에러 → 명시적 fallback 사용
        data: { hp: Math.max(0, result.ownerStateAfter.hp ?? ownerCombat.hp) },
      }),
      this.prisma.enemyState.update({
        where: { id: enemyDB.id },
        data: {
          hp: Math.max(0, result.enemyStateAfter.hp ?? enemyDB.hp),
          statusJson: AppliedStatusArraySchema.parse(
            result.enemyStateAfter.statusEffects,
          ),
          patternStateJson: EnemyPatternArraySchema.parse(
            result.enemyStateAfter.patterns,
          ),
        },
      }),
      this.prisma.runTurnLog.create({
        data: {
          runId,
          roomId,
          turnNumber: ctx.turnNumber,
          actorType: 'sword',
          actionType: 'skill',
          skillId: body.skillId,
          damageDealt: result.logs.find(
            (l) => l.actorType === 'sword' && l.damageDealt,
          )?.damageDealt,
          stateChanges: {
            stbAfter: result.swordStateAfter.stb,
            domAfter: result.swordStateAfter.dom,
            syncAfter: result.swordStateAfter.sync,
          },
        },
      }),
    ]);

    // 주인 사망 체크
    if (result.battleEnd?.ownerDied || result.ownerStateAfter.hp <= 0) {
      await this.prisma.run.update({
        where: { id: runId },
        data: { status: 'failed', endedAt: new Date(), killedBy: enemyDB.id },
      });
    }

    // 전투 승리 체크
    let droppedItems: Array<{
      id: string;
      aiName: string | null;
      aiDesc: string | null;
      tags: string[];
      effectJson: Record<string, unknown>;
      rarity: string;
    }> = [];
    if (result.battleEnd?.won || result.enemyStateAfter.hp <= 0) {
      await this.prisma.runRoom.update({
        where: { id: roomId },
        data: { status: 'completed' },
      });
      // 다음 방 잠금 해제
      await this.unlockNextRoom(runId, room);

      // 아이템 드롭 생성
      const allItems = await this.prisma.itemTemplate.findMany();
      const dropIds = this.rewardEngine.generateBattleDrops(
        run.currentFloor,
        swordDb.absorbedItemIds,
        allItems,
      );
      droppedItems = dropIds
        .map((id) => allItems.find((i) => i.id === id))
        .filter((i): i is NonNullable<typeof i> => !!i)
        .map((i) => ({
          id: i.id,
          aiName: i.aiName,
          aiDesc: i.aiDesc,
          tags: i.tags,
          effectJson: i.effectJson as Record<string, unknown>,
          rarity: i.rarity,
        }));
    }

    // 엔진 스냅샷(전투 변동값)과 DB 비변동 필드를 머지해서 프론트에 전달
    return {
      result: {
        logs: result.logs,
      },
      swordState: {
        ...result.swordStateAfter,
        // 전투 중 변하지 않는 DB 필드 (엔진 스냅샷에 없음)
        element: swordDb.element,
        gold: swordDb.gold,
        activeSkillIds: swordDb.activeSkillIds,
        passiveSkillIds: swordDb.passiveSkillIds,
        absorbedItemIds: swordDb.absorbedItemIds,
        tags: swordDb.tags,
      },
      ownerState: {
        ...result.ownerStateAfter,
        // DB 필드 (스냅샷에 없음)
        name: ownerDb.name,
        class: ownerDb.class,
        pow: ownerDb.pow,
        guard: ownerDb.guard,
        agi: ownerDb.agi,
        focus: ownerDb.focus,
        compatibilityScore: ownerDb.compatibilityScore,
      },
      enemyState: result.enemyStateAfter,
      battleEnd: result.battleEnd
        ? {
            ...result.battleEnd,
            droppedItems: droppedItems.length > 0 ? droppedItems : undefined,
          }
        : undefined,
    };
  }

  private async unlockNextRoom(
    runId: string,
    currentRoom: { floor: number; position: number },
  ) {
    const nextRoom = await this.prisma.runRoom.findFirst({
      where: {
        runId,
        floor: currentRoom.floor,
        position: currentRoom.position + 1,
        status: 'locked',
      },
    });
    if (nextRoom) {
      await this.prisma.runRoom.update({
        where: { id: nextRoom.id },
        data: { status: 'available' },
      });
    } else {
      // 다음 층 첫 방 잠금 해제
      const nextFloorRoom = await this.prisma.runRoom.findFirst({
        where: {
          runId,
          floor: currentRoom.floor + 1,
          position: 1,
          status: 'locked',
        },
      });
      if (nextFloorRoom) {
        await this.prisma.runRoom.update({
          where: { id: nextFloorRoom.id },
          data: { status: 'available' },
        });
        await this.prisma.run.update({
          where: { id: runId },
          data: { currentFloor: currentRoom.floor + 1 },
        });
      }
    }
  }

  // ─── 런 종료 (특성 후보 제공) ───────────────────────────────────────────────

  async endRun(runId: string, userId: string) {
    const [run, sword, owner] = await Promise.all([
      this.prisma.run.findFirst({ where: { id: runId, userId } }),
      this.prisma.swordState.findUnique({ where: { runId } }),
      this.prisma.ownerState.findUnique({ where: { runId } }),
    ]);

    if (!run || !sword || !owner)
      throw new NotFoundException('런을 찾을 수 없습니다.');

    // 특성 후보 수 결정 (STB 기반)
    const candidateCount = sword.stb >= 14 ? 4 : sword.stb <= 4 ? 2 : 3;

    // 기존 후보가 없으면 생성
    const existingCandidates = await this.prisma.runTraitCandidate.findMany({
      where: { runId },
    });
    let candidates = existingCandidates;

    if (candidates.length === 0) {
      const traits = await this.prisma.traitTemplate.findMany({
        where: { domOnly: sword.dom >= 5 ? undefined : false },
        orderBy: { spawnWeight: 'desc' },
        take: candidateCount + 3,
      });

      // 가중치 기반 랜덤 선택
      const shuffled = traits
        .sort(() => Math.random() - 0.5)
        .slice(0, candidateCount);
      candidates = await Promise.all(
        shuffled.map((t) =>
          this.prisma.runTraitCandidate.create({
            data: { runId, traitId: t.id },
          }),
        ),
      );
    }

    // AI 내레이션 생성
    const runEndAi = await this.ai.generateRunEndNarration(
      {
        floorDepth: run.floorDepth,
        killedBy: run.killedBy ?? '알 수 없는 원인',
        bossReached: run.bossReached,
        ownerSummary: `${owner.class} ${owner.name}`,
        swordSummary: {
          element: sword.element,
          dom: sword.dom,
          stb: sword.stb,
          tags: sword.tags,
        },
        traitCandidates: candidates.map((c) => ({
          traitId: c.traitId,
          category: 'unknown',
        })),
      },
      userId,
      runId,
    );

    // AI 라벨을 후보에 저장
    for (const label of runEndAi.traitLabels) {
      const candidate = candidates.find((c) => c.traitId === label.traitId);
      if (candidate) {
        await this.prisma.runTraitCandidate.update({
          where: { id: candidate.id },
          data: { aiLabel: label.label },
        });
      }
    }

    const traitTemplates = await Promise.all(
      candidates.map((c) =>
        this.prisma.traitTemplate.findUnique({ where: { id: c.traitId } }),
      ),
    );

    return {
      narration: runEndAi.narration,
      traitCandidates: candidates.map((c, i) => ({
        candidateId: c.id,
        traitId: c.traitId,
        aiLabel:
          c.aiLabel ??
          runEndAi.traitLabels.find((l) => l.traitId === c.traitId)?.label,
        aiName: traitTemplates[i]?.aiName,
        effectJson: traitTemplates[i]?.effectJson,
        category: traitTemplates[i]?.category,
      })),
      candidateCount,
    };
  }

  // ─── 특성 선택 확정 (영구 누적) ──────────────────────────────────────────

  async selectTrait(runId: string, userId: string, traitId: string) {
    const [run, candidate, traitTemplate] = await Promise.all([
      this.prisma.run.findFirst({ where: { id: runId, userId } }),
      this.prisma.runTraitCandidate.findFirst({ where: { runId, traitId } }),
      this.prisma.traitTemplate.findUnique({ where: { id: traitId } }),
    ]);

    if (!run) throw new NotFoundException('런을 찾을 수 없습니다.');
    if (!candidate)
      throw new BadRequestException('유효하지 않은 특성 선택입니다.');
    if (!traitTemplate)
      throw new BadRequestException('존재하지 않는 특성입니다.');

    // 마검 전용 특성 - 지배 특성 2런 제한 체크
    if (traitTemplate.domOnly) {
      const recentDomTrait = await this.prisma.permanentTraitProgress.findFirst(
        {
          where: { userId, category: 'domination' },
        },
      );
      // 간단 MVP: 이미 지배 특성이 있으면 스택 증가만 허용
    }

    // 영구 누적 (upsert)
    const existing = await this.prisma.permanentTraitProgress.findUnique({
      where: { userId_traitId: { userId, traitId } },
    });

    const newStacks = (existing?.stacks ?? 0) + 1;
    const effectiveStacks = newStacks; // softcap은 스탯 계산 시 적용

    const updated = await this.prisma.permanentTraitProgress.upsert({
      where: { userId_traitId: { userId, traitId } },
      create: { userId, traitId, category: traitTemplate.category, stacks: 1 },
      update: { stacks: { increment: 1 } },
    });

    // 후보 선택 완료 표시
    await this.prisma.runTraitCandidate.update({
      where: { id: candidate.id },
      data: { selected: true },
    });

    // 런 완전 종료
    await this.prisma.run.update({
      where: { id: runId },
      data: {
        status: run.status === 'active' ? 'completed' : run.status,
        endedAt: run.endedAt ?? new Date(),
      },
    });

    // 전체 영구 특성 반환
    const allTraits = await this.prisma.permanentTraitProgress.findMany({
      where: { userId },
    });

    return {
      selectedTrait: {
        traitId,
        stacks: updated.stacks,
        aiName: traitTemplate.aiName,
      },
      permanentTraits: allTraits,
    };
  }

  // ─── 아이템 흡수 ─────────────────────────────────────────────────────────

  async absorbItem(
    runId: string,
    userId: string,
    itemId: string,
    free = false,
  ) {
    const [run, sword, item] = await Promise.all([
      this.prisma.run.findFirst({
        where: { id: runId, userId, status: 'active' },
      }),
      this.prisma.swordState.findUnique({ where: { runId } }),
      this.prisma.itemTemplate.findUnique({ where: { id: itemId } }),
    ]);

    if (!run) throw new NotFoundException('활성 런을 찾을 수 없습니다.');
    if (!sword) throw new NotFoundException('검 상태를 찾을 수 없습니다.');
    if (!item) throw new NotFoundException('아이템을 찾을 수 없습니다.');
    if (!free && sword.gold < item.shopPrice)
      throw new BadRequestException('골드가 부족합니다.');

    const effect = item.effectJson as Record<string, number | string>;
    const updateData: Record<string, unknown> = {};

    if (effect.atkBonus)
      updateData.atk = Math.min(60, sword.atk + (effect.atkBonus as number));
    if (effect.defBonus)
      updateData.def = Math.min(40, sword.def + (effect.defBonus as number));
    if (effect.spdBonus)
      updateData.spd = Math.min(30, sword.spd + (effect.spdBonus as number));
    if (effect.syncMaxBonus)
      updateData.syncMax = Math.min(
        20,
        sword.syncMax + (effect.syncMaxBonus as number),
      );
    if (effect.stbBonus)
      updateData.stb = Math.min(
        20,
        Math.max(1, sword.stb + (effect.stbBonus as number)),
      );
    if (effect.domChange) {
      const newDom = Math.min(
        10,
        Math.max(0, sword.dom + (effect.domChange as number)),
      );
      updateData.dom = newDom;
      updateData.isMagicSword = this.magicSwordEngine.isMagicSword(newDom);
    }
    if (effect.elementChange) updateData.element = effect.elementChange;

    updateData.absorbedItemIds = [...sword.absorbedItemIds, itemId];
    updateData.gold = free ? sword.gold : sword.gold - item.shopPrice;

    const newTags =
      item.tags.length > 0 ? [...sword.tags, ...item.tags] : sword.tags;
    if (item.tags.length > 0) {
      updateData.tags = newTags;
    }

    // ── 스킬 획득 처리 ──────────────────────────────────────────────────────
    let pendingSkillSwap: string | undefined;
    let newSkillIds = [...sword.activeSkillIds];

    if (effect.addSkillId) {
      const newSkillId = effect.addSkillId as string;
      if (!newSkillIds.includes(newSkillId)) {
        if (newSkillIds.length < 4) {
          newSkillIds = [...newSkillIds, newSkillId];
          updateData.activeSkillIds = newSkillIds;
        } else {
          // 슬롯 초과 → pendingSkillSwap 반환 (DB 미반영)
          pendingSkillSwap = newSkillId;
        }
      }
    }

    // ── 스킬 업그레이드 체크 ─────────────────────────────────────────────────
    const tagMap = buildTagMap(newTags);
    const upgrades = checkSkillUpgrades(tagMap, newSkillIds);
    if (upgrades.length > 0) {
      for (const u of upgrades) {
        newSkillIds = newSkillIds.map((id) => (id === u.from ? u.to : id));
      }
      updateData.activeSkillIds = newSkillIds;
    }

    // ── 트리거 체크 ──────────────────────────────────────────────────────────
    const ownerDb = await this.prisma.ownerState.findUnique({
      where: { runId },
    });
    const triggerResults = this.triggerEngine.checkTriggers(
      tagMap,
      sword.firedTriggerIds ?? [],
      (ownerDb?.class ??
        'warrior') as import('../../shared/types/game.types').OwnerClass,
      ownerDb?.compatibilityScore ?? 50,
      newSkillIds,
    );

    const firedTriggerIds = [...(sword.firedTriggerIds ?? [])];
    for (const t of triggerResults) {
      switch (t.outcome.type) {
        case 'stat_boost':
          updateData[t.outcome.stat] = Math.min(
            t.outcome.stat === 'atk'
              ? 60
              : t.outcome.stat === 'def'
                ? 40
                : t.outcome.stat === 'spd'
                  ? 30
                  : 20,
            ((updateData[t.outcome.stat] as number | undefined) ??
              (sword[t.outcome.stat as keyof typeof sword] as number)) +
              t.outcome.amount,
          );
          break;
        case 'sync_restore':
          updateData.syncMax = Math.min(
            20,
            ((updateData.syncMax as number | undefined) ?? sword.syncMax) +
              t.outcome.amount,
          );
          break;
        case 'skill_acquire': {
          const sk = t.outcome.skillId;
          if (!newSkillIds.includes(sk)) {
            if (newSkillIds.length < 4) {
              newSkillIds = [...newSkillIds, sk];
              updateData.activeSkillIds = newSkillIds;
            } else {
              pendingSkillSwap = pendingSkillSwap ?? sk;
            }
          }
          break;
        }
        case 'skill_upgrade': {
          const { from, to } = t.outcome;
          if (newSkillIds.includes(from) && !newSkillIds.includes(to)) {
            newSkillIds = newSkillIds.map((id) => (id === from ? to : id));
            updateData.activeSkillIds = newSkillIds;
          }
          break;
        }
      }
      if (t.ruleId && !firedTriggerIds.includes(t.ruleId)) {
        firedTriggerIds.push(t.ruleId);
      }
    }
    if (firedTriggerIds.length > (sword.firedTriggerIds ?? []).length) {
      updateData.firedTriggerIds = firedTriggerIds;
    }

    const updated = await this.prisma.swordState.update({
      where: { runId },
      data: updateData,
    });

    // AI 픽셀아트 검 이미지 생성 (외형 변화가 있을 때만 / 이미지 없을 때만)
    const newSwordParams = {
      element: (updateData.element as string | undefined) ?? sword.element,
      tags: (updateData.tags as string[] | undefined) ?? sword.tags,
      dom: (updateData.dom as number | undefined) ?? sword.dom,
      atk: (updateData.atk as number | undefined) ?? sword.atk,
      def: (updateData.def as number | undefined) ?? sword.def,
      spd: (updateData.spd as number | undefined) ?? sword.spd,
      isMagicSword:
        (updateData.isMagicSword as boolean | undefined) ?? sword.isMagicSword,
      isOverdriven: sword.isOverdriven,
    };
    const oldVisualKey = computeSwordVisualKey(sword);
    const newVisualKey = computeSwordVisualKey(newSwordParams);
    const needsNewImage = !sword.swordImageBase64 || oldVisualKey !== newVisualKey;

    if (needsNewImage) {
      const imageBase64 = await this.ai
        .generateSwordImage(newSwordParams)
        .catch(() => null);
      if (imageBase64) {
        await this.prisma.swordState.update({
          where: { runId },
          data: { swordImageBase64: imageBase64 },
        });
        updated.swordImageBase64 = imageBase64;
      }
    } else {
      // 외형 변화 없음 — 기존 이미지 유지
      updated.swordImageBase64 = sword.swordImageBase64 ?? null;
    }

    return {
      swordState: updated,
      pendingSkillSwap,
      skillUpgrades: upgrades.length > 0 ? upgrades : undefined,
      triggerEvents: triggerResults.length > 0 ? triggerResults : undefined,
    };
  }

  // ─── 전투 보상 무료 흡수 ──────────────────────────────────────────────────

  async absorbBattleDrop(runId: string, userId: string, itemId: string) {
    return this.absorbItem(runId, userId, itemId, true);
  }

  // ─── 스킬 교체 (4슬롯 초과 시) ───────────────────────────────────────────

  async swapSkill(
    runId: string,
    userId: string,
    removeSkillId: string,
    addSkillId: string,
  ) {
    const run = await this.prisma.run.findFirst({
      where: { id: runId, userId, status: 'active' },
    });
    if (!run) throw new NotFoundException('활성 런을 찾을 수 없습니다.');
    const sword = await this.prisma.swordState.findUnique({ where: { runId } });
    if (!sword) throw new NotFoundException('검 상태를 찾을 수 없습니다.');
    if (!sword.activeSkillIds.includes(removeSkillId))
      throw new BadRequestException('교체할 스킬을 보유하고 있지 않습니다.');
    const skill = await this.prisma.skillTemplate.findUnique({
      where: { id: addSkillId },
    });
    if (!skill)
      throw new BadRequestException('추가할 스킬이 존재하지 않습니다.');

    const newSkillIds = sword.activeSkillIds.map((id) =>
      id === removeSkillId ? addSkillId : id,
    );
    const updated = await this.prisma.swordState.update({
      where: { runId },
      data: { activeSkillIds: newSkillIds },
    });

    return { swordState: updated };
  }

  // ─── 상점 아이템 목록 ─────────────────────────────────────────────────────

  // 효과 코드 → ItemEffect 매핑
  private readonly EFFECT_CODE_MAP: Record<
    string,
    {
      rarity: string;
      effect: Record<string, unknown>;
      price: number;
    }
  > = {
    'atk+4': { rarity: 'rare', effect: { atkBonus: 4 }, price: 20 },
    'def+4': { rarity: 'rare', effect: { defBonus: 4 }, price: 20 },
    'spd+4': { rarity: 'rare', effect: { spdBonus: 4 }, price: 20 },
    'syncMax+2': { rarity: 'rare', effect: { syncMaxBonus: 2 }, price: 18 },
    'stb+3': { rarity: 'rare', effect: { stbBonus: 3 }, price: 18 },
    'atk+2_dom+1': {
      rarity: 'rare',
      effect: { atkBonus: 2, domChange: 1 },
      price: 15,
    },
    'atk+8': { rarity: 'epic', effect: { atkBonus: 8 }, price: 40 },
    'atk+6_dom+1': {
      rarity: 'epic',
      effect: { atkBonus: 6, domChange: 1 },
      price: 35,
    },
    'stb+5': { rarity: 'epic', effect: { stbBonus: 5 }, price: 38 },
    'syncMax+4': { rarity: 'epic', effect: { syncMaxBonus: 4 }, price: 36 },
  };

  async getShopItems(runId: string, userId: string) {
    const run = await this.prisma.run.findFirst({
      where: { id: runId, userId, status: 'active' },
    });
    if (!run) throw new NotFoundException('활성 런을 찾을 수 없습니다.');

    const [sword, owner] = await Promise.all([
      this.prisma.swordState.findUnique({ where: { runId } }),
      this.prisma.ownerState.findUnique({ where: { runId } }),
    ]);
    if (!sword) throw new NotFoundException('검 상태를 찾을 수 없습니다.');

    // 층별 레어리티 필터 (battle drop과 동일 기준)
    const floor = run.currentFloor;
    const allowedRarities =
      floor >= 3
        ? ['rare', 'epic']
        : floor >= 2
          ? ['common', 'rare', 'epic']
          : ['common', 'rare'];

    const allItems = await this.prisma.itemTemplate.findMany({
      where: {
        id: { notIn: sword.absorbedItemIds },
        rarity: { in: allowedRarities },
      },
    });
    const shuffled = allItems.sort(() => Math.random() - 0.5).slice(0, 3);

    // AI 유니크 아이템 (런+층별 1개)
    const genItemId = `GEN_${runId}_${floor}`;
    let uniqueItem: unknown = null;

    const existingGen = await this.prisma.generatedItemTemplate.findUnique({
      where: { id: genItemId },
    });
    if (existingGen && !sword.absorbedItemIds.includes(genItemId)) {
      uniqueItem = existingGen;
    } else if (!existingGen) {
      // 레어리티 결정 (층이 높을수록 epic 확률 증가)
      const itemRarity =
        floor >= 3 ? 'epic' : Math.random() < 0.3 ? 'epic' : 'rare';

      const aiItem = await this.ai.generateUniqueItem(
        {
          floor,
          rarity: itemRarity,
          swordElement: sword.element,
          swordTags: sword.tags,
          ownerClass: owner?.class ?? 'warrior',
          absorbedCount: sword.absorbedItemIds.length,
        },
        runId,
        floor,
      );

      const effectData =
        this.EFFECT_CODE_MAP[aiItem.effectCode] ??
        this.EFFECT_CODE_MAP['atk+4'];
      const actualRarity = effectData.rarity;
      const shopPrice = effectData.price;

      const saved = await this.prisma.generatedItemTemplate.create({
        data: {
          id: genItemId,
          runId,
          floor,
          tags: aiItem.tags,
          effectJson: effectData.effect as Prisma.JsonObject,
          rarity: actualRarity,
          shopPrice,
          aiName: aiItem.name,
          aiDesc: aiItem.description,
          aiLore: aiItem.lore,
        },
      });
      uniqueItem = saved;
    }

    // 일반 아이템 + 유니크 아이템 합쳐서 반환 (유니크는 isUnique 표시)
    const itemList = [
      ...shuffled,
      ...(uniqueItem ? [{ ...(uniqueItem as object), isUnique: true }] : []),
    ];

    return { items: itemList, gold: sword.gold };
  }

  // ─── 방 완료 처리 (rest/event/shop용) ───────────────────────────────────

  async completeRoom(runId: string, userId: string, roomId: string) {
    const [run, room] = await Promise.all([
      this.prisma.run.findFirst({
        where: { id: runId, userId, status: 'active' },
      }),
      this.prisma.runRoom.findUnique({ where: { id: roomId } }),
    ]);

    if (!run) throw new NotFoundException('활성 런을 찾을 수 없습니다.');
    if (!room || room.runId !== runId)
      throw new NotFoundException('방을 찾을 수 없습니다.');
    if (room.status === 'completed')
      return { status: 'already_completed', ownerState: null };

    await this.prisma.runRoom.update({
      where: { id: roomId },
      data: { status: 'completed' },
    });
    await this.unlockNextRoom(runId, room);

    // rest 방이면 서버에서 HP 회복 처리
    let ownerState: Awaited<
      ReturnType<typeof this.prisma.ownerState.update>
    > | null = null;
    if (room.roomType === 'rest') {
      const owner = await this.prisma.ownerState.findUnique({
        where: { runId },
      });
      if (owner) {
        const healAmount = Math.floor(owner.hpMax * 0.3);
        const newHp = Math.min(owner.hpMax, owner.hp + healAmount);
        ownerState = await this.prisma.ownerState.update({
          where: { runId },
          data: { hp: newHp },
        });
      }
    }

    return { status: 'completed', ownerState };
  }

  // ─── 이벤트 선택 처리 ──────────────────────────────────────────────────

  async chooseEvent(
    runId: string,
    userId: string,
    eventId: string,
    choiceIndex: number,
    roomId: string,
  ) {
    const [run, room] = await Promise.all([
      this.prisma.run.findFirst({
        where: { id: runId, userId, status: 'active' },
      }),
      roomId ? this.prisma.runRoom.findUnique({ where: { id: roomId } }) : null,
    ]);
    if (!run) throw new NotFoundException('활성 런을 찾을 수 없습니다.');

    // AI 생성 이벤트 데이터 읽기
    let outcomeText = '알 수 없는 결과가 발생했다.';
    let mechanic = 'nothing';

    if (room?.aiEventJson) {
      const eventData = room.aiEventJson as unknown as {
        choices: Array<{
          label: string;
          outcomeText: string;
          mechanic: string;
        }>;
      };
      const choice = eventData.choices?.[choiceIndex];
      if (choice) {
        outcomeText = choice.outcomeText;
        mechanic = choice.mechanic;
      }
    } else {
      // 폴백: 기존 하드코딩 이벤트
      const fallback = this.resolveLegacyEventOutcome(eventId, choiceIndex);
      outcomeText = fallback.text;
      mechanic = fallback.mechanic;
    }

    // 메카닉 적용
    await this.applyEventMechanic(runId, mechanic, run.currentFloor);

    // 방 완료 + 다음 방 잠금 해제
    if (roomId) {
      await this.completeRoom(runId, userId, roomId);
    }

    return { outcome: { text: outcomeText, tag: mechanic } };
  }

  private async applyEventMechanic(
    runId: string,
    mechanic: string,
    floor: number,
  ): Promise<void> {
    const [sword, owner] = await Promise.all([
      this.prisma.swordState.findUnique({ where: { runId } }),
      this.prisma.ownerState.findUnique({ where: { runId } }),
    ]);
    if (!sword) return;

    const floorBonus = Math.max(1, Math.min(3, floor));

    switch (mechanic) {
      case 'atk_up':
        await this.prisma.swordState.update({
          where: { runId },
          data: { atk: Math.min(60, sword.atk + floorBonus) },
        });
        break;
      case 'def_up':
        await this.prisma.swordState.update({
          where: { runId },
          data: { def: Math.min(40, sword.def + floorBonus) },
        });
        break;
      case 'spd_up':
        await this.prisma.swordState.update({
          where: { runId },
          data: { spd: Math.min(30, sword.spd + floorBonus) },
        });
        break;
      case 'stb_up':
        await this.prisma.swordState.update({
          where: { runId },
          data: { stb: Math.min(20, sword.stb + 2) },
        });
        break;
      case 'stb_down':
        await this.prisma.swordState.update({
          where: { runId },
          data: { stb: Math.max(1, sword.stb - 2) },
        });
        break;
      case 'dom_up':
        await this.prisma.swordState.update({
          where: { runId },
          data: { dom: Math.min(10, sword.dom + 1) },
        });
        break;
      case 'sync_restore':
        await this.prisma.swordState.update({
          where: { runId },
          data: { syncMax: Math.min(20, sword.syncMax + 2) },
        });
        break;
      case 'gold_gain':
        await this.prisma.swordState.update({
          where: { runId },
          data: { gold: sword.gold + floor * 8 },
        });
        break;
      case 'hp_restore':
        if (owner) {
          const heal = Math.floor(owner.hpMax * 0.3);
          await this.prisma.ownerState.update({
            where: { runId },
            data: { hp: Math.min(owner.hpMax, owner.hp + heal) },
          });
        }
        break;
      case 'hp_lose':
        if (owner) {
          const dmg = Math.floor(owner.hpMax * 0.15);
          await this.prisma.ownerState.update({
            where: { runId },
            data: { hp: Math.max(1, owner.hp - dmg) },
          });
        }
        break;
      case 'tag_fire':
      case 'tag_ice':
      case 'tag_dark':
      case 'tag_soul':
      case 'tag_thunder': {
        const tag = mechanic.replace('tag_', '');
        await this.prisma.swordState.update({
          where: { runId },
          data: { tags: { push: tag } },
        });
        break;
      }
      default:
        break; // 'nothing' 또는 알 수 없는 코드
    }
  }

  private resolveLegacyEventOutcome(
    eventId: string,
    choiceIndex: number,
  ): { text: string; mechanic: string } {
    const id = eventId.toUpperCase();
    if (id === 'EVENT_MYSTERY') {
      if (choiceIndex === 0) {
        return {
          text: '낡은 제단이 검의 힘을 흡수했다. 검날이 안정된다.',
          mechanic: 'stb_up',
        };
      }
      return {
        text: '조용히 지나쳤다. 뒤에서 무언가 바스러지는 소리가 들렸다.',
        mechanic: 'nothing',
      };
    }
    return { text: '알 수 없는 결과가 발생했다.', mechanic: 'nothing' };
  }

  // ─── 활성 스킬 조회 (전투 UI용) ─────────────────────────────────────────
  async getAllSkills(runId: string, userId: string) {
    const run = await this.prisma.run.findFirst({
      where: { id: runId, userId, status: 'active' },
    });
    if (!run) throw new NotFoundException('활성 런을 찾을 수 없습니다.');

    const sword = await this.prisma.swordState.findUnique({ where: { runId } });
    if (!sword) throw new NotFoundException('검 상태를 찾을 수 없습니다.');

    const skillTemplates = await this.prisma.skillTemplate.findMany({
      where: { id: { in: sword.activeSkillIds } },
      orderBy: { id: 'asc' },
    });

    return skillTemplates;
  }
}
