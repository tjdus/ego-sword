import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';
import { createHash } from 'crypto';

// ─── AI 입출력 스키마 ─────────────────────────────────────────────────────────

export interface OwnerAiInput {
  class: string;
  rarity: string;
  combatStats: Record<string, number>;
  personalityStats: Record<string, number>;
  ownerTraits: string[];
  floorDepth: number;
  swordElement: string;
  compatibilityScore: number;
}

export interface OwnerAiOutput {
  name: string;
  oneLiner: string;
  speechStyle: { tone: string; quirk: string };
  combatBarks: { start: string; lowHp: string; victory: string };
  exploreBarks: { trapFound: string; treasureFound: string };
}

export interface SkillAiInput {
  templateId: string;
  type: string;
  cost: number;
  element: string;
  effect: Record<string, unknown>;
  tags: string[];
}

export interface SkillAiOutput {
  name: string;
  description: string;
  vfxKeywords: string[];
  quote: string;
}

export interface TraitAiInput {
  traitId: string;
  category: string;
  element?: string;
  effectDesc: string;
  mood: 'early' | 'mid' | 'deep'; // stacks 구간
}

export interface TraitAiOutput {
  name: string;
  description: string;
}

export interface RunEndAiInput {
  floorDepth: number;
  killedBy: string;
  bossReached: boolean;
  ownerSummary: string;
  swordSummary: { element: string; dom: number; stb: number; tags: string[] };
  traitCandidates: { traitId: string; category: string }[];
}

export interface RunEndAiOutput {
  narration: string;
  traitLabels: { traitId: string; label: string }[];
}

// ─── 금칙어 필터 ─────────────────────────────────────────────────────────────

const BANNED_WORDS = [
  '섹스', '야한', '음란', '강간', '살인마', '자살', '혐오',
  'sex', 'porn', 'kill yourself', 'hate',
];

function hasBannedWord(text: string): boolean {
  const lower = text.toLowerCase();
  return BANNED_WORDS.some(w => lower.includes(w.toLowerCase()));
}

function sanitizeOutput(obj: Record<string, unknown>): boolean {
  const str = JSON.stringify(obj);
  return !hasBannedWord(str);
}

// ─── 폴백 텍스트 ─────────────────────────────────────────────────────────────

const OWNER_FALLBACK_BY_CLASS: Record<string, OwnerAiOutput> = {
  warrior: {
    name: '이름 없는 검사',
    oneLiner: '힘이 전부다.',
    speechStyle: { tone: '거칠', quirk: '짧게 끊음' },
    combatBarks: { start: '덤벼라.', lowHp: '아직이다.', victory: '끝났다.' },
    exploreBarks: { trapFound: '조심해.', treasureFound: '오.' },
  },
  mage: {
    name: '이름 없는 마법사',
    oneLiner: '지식이 힘이다.',
    speechStyle: { tone: '차분', quirk: '논리적으로 말함' },
    combatBarks: { start: '시작하지.', lowHp: '…계산이 틀렸나.', victory: '예상대로다.' },
    exploreBarks: { trapFound: '마법 반응 감지.', treasureFound: '흥미롭군.' },
  },
  paladin: {
    name: '이름 없는 성기사',
    oneLiner: '빛이 인도하리라.',
    speechStyle: { tone: '열혈', quirk: '격식체 사용' },
    combatBarks: { start: '정의를 위해!', lowHp: '포기할 수 없다.', victory: '빛의 가호로.' },
    exploreBarks: { trapFound: '위험을 감지했다.', treasureFound: '신의 인도인가.' },
  },
  rogue: {
    name: '이름 없는 도적',
    oneLiner: '그림자 속에서 기회를 본다.',
    speechStyle: { tone: '냉소', quirk: '반말' },
    combatBarks: { start: '운이 다했네.', lowHp: '아직 끝난 게 아냐.', victory: '쉬웠어.' },
    exploreBarks: { trapFound: '예상했지.', treasureFound: '잭팟이야.' },
  },
  hunter: {
    name: '이름 없는 사냥꾼',
    oneLiner: '표적은 도망치지 못한다.',
    speechStyle: { tone: '차분', quirk: '간결하게 말함' },
    combatBarks: { start: '표적 확인.', lowHp: '추격은 계속된다.', victory: '사냥 완료.' },
    exploreBarks: { trapFound: '흔적이 있다.', treasureFound: '보상이군.' },
  },
  berserker: {
    name: '이름 없는 광전사',
    oneLiner: '싸움이 전부다.',
    speechStyle: { tone: '거칠', quirk: '고함치듯 말함' },
    combatBarks: { start: '으아아!', lowHp: '더 강해진다!', victory: '하하하!' },
    exploreBarks: { trapFound: '함정? 상관없어!', treasureFound: '오오!' },
  },
};

function getOwnerFallback(ownerClass: string): OwnerAiOutput {
  return OWNER_FALLBACK_BY_CLASS[ownerClass] ?? OWNER_FALLBACK_BY_CLASS['warrior'];
}

const SKILL_FALLBACK: SkillAiOutput = {
  name: '칼날의 일격',
  description: '예리한 칼날로 적을 공격한다.',
  vfxKeywords: ['빠른 섬광', '금속 반짝임'],
  quote: '….',
};

const TRAIT_FALLBACK: TraitAiOutput = {
  name: '특성의 흔적',
  description: '칼 끝에 작은 흔적이 남았다.',
};

const RUN_END_FALLBACK: RunEndAiOutput = {
  narration: '당신은 낡은 검으로 돌아갔다. 영혼 파편이 흩어졌다.\n그러나 칼 끝에 작은 흔적이 남아 있다.',
  traitLabels: [],
};

// ─── AI 서비스 ────────────────────────────────────────────────────────────────

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: Anthropic;
  private readonly TIMEOUT_MS = 3000;
  private readonly MODEL = 'claude-haiku-4-5-20251001';

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.client = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY') ?? '',
    });
  }

  // ─── 캐시 키 생성 ─────────────────────────────────────────────────────────

  private makeCacheKey(type: string, data: Record<string, unknown>): string {
    const raw = JSON.stringify({ type, data });
    return createHash('sha256').update(raw).digest('hex').slice(0, 32);
  }

  private makeSeedKey(userId: string, runId: string, extra: string): string {
    return createHash('sha256')
      .update(`${userId}:${runId}:${extra}:ko`)
      .digest('hex')
      .slice(0, 16);
  }

  // ─── 캐시 조회/저장 ───────────────────────────────────────────────────────

  private async getFromCache(cacheKey: string): Promise<Record<string, unknown> | null> {
    const cached = await this.prisma.aiTextCache.findUnique({ where: { cacheKey } });
    if (!cached) return null;
    if (cached.expiresAt < new Date()) {
      await this.prisma.aiTextCache.delete({ where: { cacheKey } });
      return null;
    }
    await this.prisma.aiTextCache.update({
      where: { cacheKey },
      data: { hitCount: { increment: 1 } },
    });
    return cached.payload as Record<string, unknown>;
  }

  private async saveToCache(
    cacheKey: string,
    cacheType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30일
    await this.prisma.aiTextCache.upsert({
      where: { cacheKey },
      create: { cacheKey, cacheType, payload: payload as any, expiresAt },
      update: { payload: payload as any, expiresAt },
    });
  }

  // ─── AI 호출 (타임아웃 + 폴백) ───────────────────────────────────────────

  private async callWithTimeout<T>(
    prompt: string,
    systemPrompt: string,
    fallback: T,
    validator: (data: unknown) => data is T,
  ): Promise<T> {
    const timeoutPromise = new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('AI timeout')), this.TIMEOUT_MS),
    );

    const callPromise = this.client.messages.create({
      model: this.MODEL,
      max_tokens: 512,
      temperature: 0.7,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    }).then(res => {
      const text = res.content[0]?.type === 'text' ? res.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');
      const parsed = JSON.parse(jsonMatch[0]);
      if (!validator(parsed) || !sanitizeOutput(parsed as Record<string, unknown>)) {
        throw new Error('Invalid schema or banned content');
      }
      return parsed;
    });

    try {
      return await Promise.race([callPromise, timeoutPromise]);
    } catch (err) {
      this.logger.warn(`AI call failed: ${err instanceof Error ? err.message : String(err)}`);
      return fallback;
    }
  }

  // ─── 1) 주인 NPC 텍스트 생성 ─────────────────────────────────────────────

  async generateOwnerText(
    input: OwnerAiInput,
    userId: string,
    runId: string,
  ): Promise<OwnerAiOutput> {
    const archKey = this.makeCacheKey('owner', {
      class: input.class,
      rarity: input.rarity,
      floor: Math.floor(input.floorDepth),
      element: input.swordElement,
    });

    const cached = await this.getFromCache(archKey);
    if (cached) return cached as unknown as OwnerAiOutput;

    const seedKey = this.makeSeedKey(userId, runId, `owner:${input.class}`);
    const systemPrompt = `당신은 한국어 판타지 RPG의 NPC 대사 생성기입니다.
규칙:
- 이름은 2~4글자 한국/판타지 이름
- 대사는 20자 이내
- 폭력적/성적 표현 금지
- 수치/게임 밸런스 절대 언급 금지
- 반드시 JSON만 출력 (마크다운 금지)`;

    const prompt = `seedKey: ${seedKey}
입력: ${JSON.stringify(input)}
아래 JSON 스키마로 정확히 출력:
{"name":"","oneLiner":"","speechStyle":{"tone":"차분|거칠|냉소|열혈","quirk":""},"combatBarks":{"start":"","lowHp":"","victory":""},"exploreBarks":{"trapFound":"","treasureFound":""}}`;

    const isOwnerOutput = (d: unknown): d is OwnerAiOutput =>
      typeof d === 'object' && d !== null &&
      'name' in d && 'oneLiner' in d && 'speechStyle' in d &&
      'combatBarks' in d && 'exploreBarks' in d;

    const result = await this.callWithTimeout(
      prompt,
      systemPrompt,
      getOwnerFallback(input.class),
      isOwnerOutput,
    );

    await this.saveToCache(archKey, 'owner', result as unknown as Record<string, unknown>);
    return result;
  }

  // ─── 2) 스킬 텍스트 생성 ─────────────────────────────────────────────────

  async generateSkillText(input: SkillAiInput): Promise<SkillAiOutput> {
    const tagsSignature = [...input.tags].sort().join(',');
    const cacheKey = this.makeCacheKey('skill', {
      id: input.templateId,
      element: input.element,
      tags: tagsSignature,
    });

    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached as unknown as SkillAiOutput;

    const systemPrompt = `당신은 판타지 RPG 스킬 이름/설명 생성기입니다.
규칙:
- 스킬명은 5~15글자 한국어
- 설명은 30자 이내
- vfxKeywords는 시각 효과 2~3개 (짧은 명사)
- quote는 10자 이내 독백
- 수치 언급 금지, JSON만 출력`;

    const prompt = `입력: ${JSON.stringify(input)}
출력 스키마: {"name":"","description":"","vfxKeywords":["",""],"quote":""}`;

    const isSkillOutput = (d: unknown): d is SkillAiOutput =>
      typeof d === 'object' && d !== null &&
      'name' in d && 'description' in d && 'vfxKeywords' in d && 'quote' in d;

    const result = await this.callWithTimeout(
      prompt, systemPrompt, SKILL_FALLBACK, isSkillOutput,
    );

    await this.saveToCache(cacheKey, 'skill', result as unknown as Record<string, unknown>);
    return result;
  }

  // ─── 3) 특성 텍스트 생성 ─────────────────────────────────────────────────

  async generateTraitText(input: TraitAiInput): Promise<TraitAiOutput> {
    const cacheKey = this.makeCacheKey('trait', {
      id: input.traitId,
      element: input.element,
      mood: input.mood,
    });

    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached as unknown as TraitAiOutput;

    const systemPrompt = `판타지 RPG 특성 이름/설명 생성기. JSON만 출력.`;
    const prompt = `입력: ${JSON.stringify(input)}
출력: {"name":"(5~12글자)","description":"(20~40글자, 시적 표현)"}`;

    const isTraitOutput = (d: unknown): d is TraitAiOutput =>
      typeof d === 'object' && d !== null && 'name' in d && 'description' in d;

    const result = await this.callWithTimeout(
      prompt, systemPrompt, TRAIT_FALLBACK, isTraitOutput,
    );

    await this.saveToCache(cacheKey, 'trait', result as unknown as Record<string, unknown>);
    return result;
  }

  // ─── 4) 런 종료 내레이션 생성 ────────────────────────────────────────────

  async generateRunEndNarration(
    input: RunEndAiInput,
    userId: string,
    runId: string,
  ): Promise<RunEndAiOutput> {
    const seedKey = this.makeSeedKey(userId, runId, `end:${input.killedBy}`);
    const cacheKey = this.makeCacheKey('run_end', {
      killedBy: input.killedBy,
      depth: input.floorDepth,
      element: input.swordSummary.element,
      seedKey,
    });

    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached as unknown as RunEndAiOutput;

    const systemPrompt = `판타지 RPG 런 종료 내레이션 생성기.
규칙:
- narration은 2~3줄, 시적이고 감성적
- traitLabels는 각 traitId에 대한 추억 문구 1줄 (20자 이내)
- 수치/확률 절대 언급 금지
- JSON만 출력`;

    const prompt = `seedKey: ${seedKey}
입력: ${JSON.stringify(input)}
출력: {"narration":"","traitLabels":[{"traitId":"","label":""}]}`;

    const isRunEndOutput = (d: unknown): d is RunEndAiOutput =>
      typeof d === 'object' && d !== null &&
      'narration' in d && 'traitLabels' in d &&
      Array.isArray((d as RunEndAiOutput).traitLabels);

    const fallback: RunEndAiOutput = {
      ...RUN_END_FALLBACK,
      traitLabels: input.traitCandidates.map(t => ({
        traitId: t.traitId,
        label: '그 기억이 칼 끝에 남았다.',
      })),
    };

    const result = await this.callWithTimeout(
      prompt, systemPrompt, fallback, isRunEndOutput,
    );

    await this.saveToCache(cacheKey, 'run_end', result as unknown as Record<string, unknown>);
    return result;
  }
}
