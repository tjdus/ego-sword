import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import Replicate from 'replicate';
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
  // 확장 필드 (v2, 구 캐시 엔트리는 없을 수 있음)
  backstory?: string;
  swordOpinion?: string;
  uniqueQuirk?: string;
}

export interface EventAiChoice {
  label: string; // 선택지 텍스트 (15자 이내)
  hint: string; // 힌트 (10자 이내)
  outcomeText: string; // 결과 서술 (20자 이내)
  mechanic: string; // 안전 메카닉 코드
}

export interface EventAiOutput {
  title: string; // 이벤트 제목 (10자 이내)
  description: string; // 상황 묘사 (50자 이내)
  choices: EventAiChoice[];
}

export interface EventAiInput {
  floor: number;
  ownerName: string;
  ownerClass: string;
  ownerPersonality: Record<string, number>;
  swordElement: string;
  swordTags: string[];
  compatScore: number;
  dom: number;
  stb: number;
}

export interface ItemAiInput {
  floor: number;
  rarity: string; // rare|epic
  swordElement: string;
  swordTags: string[];
  ownerClass: string;
  absorbedCount: number;
}

export interface ItemAiOutput {
  name: string; // 아이템 이름 (8자 이내)
  description: string; // 설명 (25자 이내)
  lore: string; // 한 줄 이야기 (20자 이내)
  tags: string[]; // 허용 태그 목록에서 선택
  effectCode: string; // 안전 효과 코드
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
  '섹스',
  '야한',
  '음란',
  '강간',
  '살인마',
  '자살',
  '혐오',
  'sex',
  'porn',
  'kill yourself',
  'hate',
];

function hasBannedWord(text: string): boolean {
  const lower = text.toLowerCase();
  return BANNED_WORDS.some((w) => lower.includes(w.toLowerCase()));
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
    combatBarks: {
      start: '시작하지.',
      lowHp: '…계산이 틀렸나.',
      victory: '예상대로다.',
    },
    exploreBarks: { trapFound: '마법 반응 감지.', treasureFound: '흥미롭군.' },
  },
  paladin: {
    name: '이름 없는 성기사',
    oneLiner: '빛이 인도하리라.',
    speechStyle: { tone: '열혈', quirk: '격식체 사용' },
    combatBarks: {
      start: '정의를 위해!',
      lowHp: '포기할 수 없다.',
      victory: '빛의 가호로.',
    },
    exploreBarks: {
      trapFound: '위험을 감지했다.',
      treasureFound: '신의 인도인가.',
    },
  },
  rogue: {
    name: '이름 없는 도적',
    oneLiner: '그림자 속에서 기회를 본다.',
    speechStyle: { tone: '냉소', quirk: '반말' },
    combatBarks: {
      start: '운이 다했네.',
      lowHp: '아직 끝난 게 아냐.',
      victory: '쉬웠어.',
    },
    exploreBarks: { trapFound: '예상했지.', treasureFound: '잭팟이야.' },
  },
  hunter: {
    name: '이름 없는 사냥꾼',
    oneLiner: '표적은 도망치지 못한다.',
    speechStyle: { tone: '차분', quirk: '간결하게 말함' },
    combatBarks: {
      start: '표적 확인.',
      lowHp: '추격은 계속된다.',
      victory: '사냥 완료.',
    },
    exploreBarks: { trapFound: '흔적이 있다.', treasureFound: '보상이군.' },
  },
  berserker: {
    name: '이름 없는 광전사',
    oneLiner: '싸움이 전부다.',
    speechStyle: { tone: '거칠', quirk: '고함치듯 말함' },
    combatBarks: {
      start: '으아아!',
      lowHp: '더 강해진다!',
      victory: '하하하!',
    },
    exploreBarks: { trapFound: '함정? 상관없어!', treasureFound: '오오!' },
  },
};

function getOwnerFallback(ownerClass: string): OwnerAiOutput {
  return (
    OWNER_FALLBACK_BY_CLASS[ownerClass] ?? OWNER_FALLBACK_BY_CLASS['warrior']
  );
}

const EVENT_FALLBACK: EventAiOutput = {
  title: '낡은 제단',
  description: '어둠 속에 낡은 제단이 있다. 뭔가를 원하는 것 같다.',
  choices: [
    {
      label: '봉납한다',
      hint: '검을 바친다',
      outcomeText: '검날이 안정되었다.',
      mechanic: 'stb_up',
    },
    {
      label: '무시한다',
      hint: '그냥 지나친다',
      outcomeText: '조용히 지나쳤다.',
      mechanic: 'nothing',
    },
    {
      label: '조사한다',
      hint: '위험할 수도',
      outcomeText: '뭔가가 손에 들어왔다.',
      mechanic: 'gold_gain',
    },
  ],
};

const ITEM_FALLBACK: ItemAiOutput = {
  name: '신비한 파편',
  description: '출처를 알 수 없는 파편.',
  lore: '기억 속에서 왔다.',
  tags: ['soul'],
  effectCode: 'atk+4',
};

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
  narration:
    '당신은 낡은 검으로 돌아갔다. 영혼 파편이 흩어졌다.\n그러나 칼 끝에 작은 흔적이 남아 있다.',
  traitLabels: [],
};

// ─── AI 서비스 ────────────────────────────────────────────────────────────────

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: Anthropic;
  private readonly replicate: Replicate;
  private readonly TIMEOUT_MS = 150000;
  private readonly IMAGE_TIMEOUT_MS = 30000;
  private readonly MODEL = 'claude-haiku-4-5-20251001';

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.client = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY') ?? '',
    });
    this.replicate = new Replicate({
      auth: this.config.get<string>('REPLICATE_API_TOKEN') ?? '',
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

  private async getFromCache(
    cacheKey: string,
  ): Promise<Record<string, unknown> | null> {
    const cached = await this.prisma.aiTextCache.findUnique({
      where: { cacheKey },
    });
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

    const callPromise = this.client.messages
      .create({
        model: this.MODEL,
        max_tokens: 512,
        temperature: 0.7,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      })
      .then((res) => {
        const text = res.content[0]?.type === 'text' ? res.content[0].text : '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON in response');
        const parsed = JSON.parse(jsonMatch[0]);
        if (
          !validator(parsed) ||
          !sanitizeOutput(parsed as Record<string, unknown>)
        ) {
          throw new Error('Invalid schema or banned content');
        }
        console.log('AI response parsed successfully:', parsed); // 디버깅용 로그
        return parsed;
      });

    try {
      return await Promise.race([callPromise, timeoutPromise]);
    } catch (err) {
      this.logger.warn(
        `AI call failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return fallback;
    }
  }

  // ─── 1) 주인 NPC 텍스트 생성 ─────────────────────────────────────────────

  async generateOwnerText(
    input: OwnerAiInput,
    userId: string,
    runId: string,
  ): Promise<OwnerAiOutput> {
    // v2: backstory/swordOpinion/uniqueQuirk 포함한 새 캐시 키
    const archKey = this.makeCacheKey('owner_v2', {
      class: input.class,
      rarity: input.rarity,
      floor: Math.floor(input.floorDepth),
      element: input.swordElement,
    });

    const cached = await this.getFromCache(archKey);
    if (cached) return cached as unknown as OwnerAiOutput;

    const seedKey = this.makeSeedKey(userId, runId, `owner:${input.class}`);
    const systemPrompt = `당신은 한국어 판타지 RPG의 NPC 생성기입니다. 자아를 가진 검(에고소드)의 주인이 될 독특하고 기억에 남는 캐릭터를 만드세요.
규칙:
- 이름은 2~4글자 한국/판타지 이름 (매우 특이하고 개성적으로)
- 모든 텍스트는 자리수 이내
- backstory는 완전히 특이하고 독창적인 과거 (예: 평범한 용사 X, 감자를 섬기는 광신자 O)
- swordOpinion은 이 검에 대한 첫인상을 개성있게
- uniqueQuirk은 구체적이고 이상한 버릇 하나 (예: "싸우기 전 반드시 신발을 핥는다")
- 폭력적/성적 표현 금지, 수치/게임 밸런스 절대 언급 금지
- 반드시 JSON만 출력 (마크다운 금지)`;

    const prompt = `seedKey: ${seedKey}
입력: ${JSON.stringify(input)}
아래 JSON 스키마로 정확히 출력:
{"name":"","oneLiner":"(20자 이내)","speechStyle":{"tone":"차분|거칠|냉소|열혈","quirk":""},"combatBarks":{"start":"","lowHp":"","victory":""},"exploreBarks":{"trapFound":"","treasureFound":""},"backstory":"(30자 이내, 완전히 특이하게)","swordOpinion":"(20자 이내)","uniqueQuirk":"(20자 이내, 구체적으로)"}`;

    const isOwnerOutput = (d: unknown): d is OwnerAiOutput =>
      typeof d === 'object' &&
      d !== null &&
      'name' in d &&
      'oneLiner' in d &&
      'speechStyle' in d &&
      'combatBarks' in d &&
      'exploreBarks' in d;

    const result = await this.callWithTimeout(
      prompt,
      systemPrompt,
      getOwnerFallback(input.class),
      isOwnerOutput,
    );

    await this.saveToCache(
      archKey,
      'owner_v2',
      result as unknown as Record<string, unknown>,
    );
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
      typeof d === 'object' &&
      d !== null &&
      'name' in d &&
      'description' in d &&
      'vfxKeywords' in d &&
      'quote' in d;

    const result = await this.callWithTimeout(
      prompt,
      systemPrompt,
      SKILL_FALLBACK,
      isSkillOutput,
    );

    await this.saveToCache(
      cacheKey,
      'skill',
      result as unknown as Record<string, unknown>,
    );
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
      prompt,
      systemPrompt,
      TRAIT_FALLBACK,
      isTraitOutput,
    );

    await this.saveToCache(
      cacheKey,
      'trait',
      result as unknown as Record<string, unknown>,
    );
    return result;
  }

  // ─── 4) 이벤트 생성 ──────────────────────────────────────────────────────

  async generateEventData(
    input: EventAiInput,
    runId: string,
    roomId: string,
  ): Promise<EventAiOutput> {
    const cacheKey = this.makeCacheKey('event', { runId, roomId });

    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached as unknown as EventAiOutput;

    const depthLabel =
      input.floor <= 1
        ? '초반 (신비로운)'
        : input.floor <= 2
          ? '중반 (위험한)'
          : '후반 (극적인)';
    const tagStr =
      input.swordTags.length > 0
        ? input.swordTags.slice(0, 5).join(', ')
        : '없음';

    const systemPrompt = `당신은 "나는 전설의 검이다" 게임의 이벤트 시나리오 작가입니다.
자아를 가진 검(에고소드)과 주인의 던전 탐험 중 발생하는 완전히 독창적이고 기묘한 사건을 생성하세요.
규칙:
- 이벤트는 반드시 검의 자아/의식과 관련이 있어야 합니다
- 선택지는 정확히 3개, 각각 완전히 다른 성격의 대응
- 흔한 클리셰(버려진 신전, 무너진 성 등) 절대 금지 - 완전히 특이하게
- outcomeText는 시적이고 간결하게 (20자 이내)
- mechanic은 반드시 아래 목록 중 하나만 사용:
  nothing, atk_up, def_up, spd_up, stb_up, stb_down, dom_up, hp_restore, hp_lose, gold_gain, sync_restore, tag_fire, tag_ice, tag_dark, tag_soul, tag_thunder
- 수치 언급 금지, JSON만 출력`;

    const prompt = `현재 상황:
- ${input.floor}층 (${depthLabel})
- 주인: ${input.ownerName} (${input.ownerClass})
- 검 원소: ${input.swordElement}, 태그: ${tagStr}
- 조화도: ${input.compatScore}/100, 지배력(DOM): ${input.dom}, 안정도(STB): ${input.stb}

아래 JSON 스키마로만 출력:
{"title":"(10자 이내)","description":"(50자 이내, 서정적이고 기묘하게)","choices":[{"label":"(15자 이내)","hint":"(10자 이내)","outcomeText":"(20자 이내)","mechanic":"mechanic_code"},{"label":"","hint":"","outcomeText":"","mechanic":""},{"label":"","hint":"","outcomeText":"","mechanic":""}]}`;

    const isEventOutput = (d: unknown): d is EventAiOutput =>
      typeof d === 'object' &&
      d !== null &&
      'title' in d &&
      'description' in d &&
      'choices' in d &&
      Array.isArray((d as EventAiOutput).choices) &&
      (d as EventAiOutput).choices.length >= 2;

    const result = await this.callWithTimeout(
      prompt,
      systemPrompt,
      EVENT_FALLBACK,
      isEventOutput,
    );

    // choices mechanic 유효성 검사 (허용된 코드만)
    const ALLOWED_MECHANICS = new Set([
      'nothing',
      'atk_up',
      'def_up',
      'spd_up',
      'stb_up',
      'stb_down',
      'dom_up',
      'hp_restore',
      'hp_lose',
      'gold_gain',
      'sync_restore',
      'tag_fire',
      'tag_ice',
      'tag_dark',
      'tag_soul',
      'tag_thunder',
    ]);
    const sanitized: EventAiOutput = {
      ...result,
      choices: result.choices.map((c) => ({
        ...c,
        mechanic: ALLOWED_MECHANICS.has(c.mechanic) ? c.mechanic : 'nothing',
      })),
    };

    await this.saveToCache(
      cacheKey,
      'event',
      sanitized as unknown as Record<string, unknown>,
    );
    return sanitized;
  }

  // ─── 5) 유니크 아이템 생성 ───────────────────────────────────────────────

  async generateUniqueItem(
    input: ItemAiInput,
    runId: string,
    floor: number,
  ): Promise<ItemAiOutput> {
    const cacheKey = this.makeCacheKey('unique_item', { runId, floor });

    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached as unknown as ItemAiOutput;

    const rarityEffectCodes =
      input.rarity === 'epic'
        ? ['atk+8', 'atk+6_dom+1', 'stb+5', 'syncMax+4']
        : ['atk+4', 'def+4', 'spd+4', 'syncMax+2', 'stb+3', 'atk+2_dom+1'];

    const allowedTags = [
      'fire',
      'ice',
      'dark',
      'soul',
      'thunder',
      'light',
      'poison',
      'combat',
      'curse',
      'berserker',
    ];

    const systemPrompt = `당신은 판타지 RPG의 전설적 아이템 생성기입니다.
자아를 가진 검이 흡수할 완전히 독창적이고 기묘한 아이템을 만드세요.
규칙:
- 이름은 완전히 특이하고 창의적으로 (평범한 이름 금지)
- lore는 한 줄 이야기로 시적이고 기이하게
- tags는 반드시 허용 목록에서만: ${allowedTags.join(', ')}
- effectCode는 반드시 허용 목록에서만: ${rarityEffectCodes.join(', ')}
- 수치 언급 금지, JSON만 출력`;

    const prompt = `입력 맥락:
- ${floor}층, 레어리티: ${input.rarity}
- 검 원소: ${input.swordElement}, 현재 태그: ${input.swordTags.join(', ') || '없음'}
- 주인 직업: ${input.ownerClass}, 흡수 횟수: ${input.absorbedCount}

아래 JSON 스키마로 출력:
{"name":"(8자 이내, 완전히 특이하게)","description":"(25자 이내)","lore":"(20자 이내, 시적으로)","tags":["허용태그"],"effectCode":"허용코드"}`;

    const isItemOutput = (d: unknown): d is ItemAiOutput =>
      typeof d === 'object' &&
      d !== null &&
      'name' in d &&
      'description' in d &&
      'lore' in d &&
      'tags' in d &&
      'effectCode' in d &&
      Array.isArray((d as ItemAiOutput).tags) &&
      rarityEffectCodes.includes((d as ItemAiOutput).effectCode);

    const result = await this.callWithTimeout(
      prompt,
      systemPrompt,
      ITEM_FALLBACK,
      isItemOutput,
    );

    // tags 유효성 필터
    const sanitized: ItemAiOutput = {
      ...result,
      tags: result.tags.filter((t) => allowedTags.includes(t)).slice(0, 2),
      effectCode: rarityEffectCodes.includes(result.effectCode)
        ? result.effectCode
        : rarityEffectCodes[0],
    };

    await this.saveToCache(
      cacheKey,
      'unique_item',
      sanitized as unknown as Record<string, unknown>,
    );
    return sanitized;
  }

  // ─── 6) 런 종료 내레이션 생성 ────────────────────────────────────────────

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
      typeof d === 'object' &&
      d !== null &&
      'narration' in d &&
      'traitLabels' in d &&
      Array.isArray((d as RunEndAiOutput).traitLabels);

    const fallback: RunEndAiOutput = {
      ...RUN_END_FALLBACK,
      traitLabels: input.traitCandidates.map((t) => ({
        traitId: t.traitId,
        label: '그 기억이 칼 끝에 남았다.',
      })),
    };

    const result = await this.callWithTimeout(
      prompt,
      systemPrompt,
      fallback,
      isRunEndOutput,
    );

    await this.saveToCache(
      cacheKey,
      'run_end',
      result as unknown as Record<string, unknown>,
    );
    return result;
  }

  // ─── 검 픽셀아트 이미지 생성 ──────────────────────────────────────────────────

  /**
   * SwordState를 기반으로 픽셀아트 무기 이미지를 Replicate로 생성한다.
   * 태그 → 스탯 → 원소 우선순위로 무기 종류를 결정한다.
   * 실패 시 null 반환 (graceful fallback).
   */
  async generateSwordImage(sword: {
    element: string;
    tags: string[];
    dom: number;
    atk: number;
    def: number;
    spd: number;
    isMagicSword: boolean;
    isOverdriven: boolean;
  }): Promise<string | null> {
    const weaponType = this.getSwordWeaponType(sword);
    const elementColor = this.getElementColorDesc(sword.element);
    const modeModifier = sword.isMagicSword
      ? 'corrupted demonic form, dark energy swirling around blade'
      : sword.isOverdriven
        ? 'cracked blade with unstable red glowing cracks'
        : '';

    const prompt = [
      'pixel art RPG weapon icon',
      weaponType,
      `${elementColor} color scheme`,
      modeModifier,
      '16-bit retro style',
      'dark fantasy game sprite',
      'white background',
      'centered composition',
      'no text no human',
      'highly detailed',
    ]
      .filter(Boolean)
      .join(', ');

    try {
      const output = await Promise.race([
        this.replicate.run('retro-diffusion/rd-fast', {
          input: {
            prompt,
            num_outputs: 1,
            aspect_ratio: '1:1',
            output_format: 'png',
            output_quality: 80,
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Image generation timeout')),
            this.IMAGE_TIMEOUT_MS,
          ),
        ),
      ]);

      // Replicate output: ReadableStream or URL string array
      let imageUrl: string | null = null;
      if (Array.isArray(output) && typeof output[0] === 'string') {
        imageUrl = output[0];
      } else if (
        output &&
        typeof (output as { url?: () => Promise<string> }).url === 'function'
      ) {
        imageUrl = await (output as { url: () => Promise<string> }).url();
      } else if (typeof output === 'string') {
        imageUrl = output;
      }

      if (!imageUrl) return null;

      // Replicate URL → buffer → base64
      const resp = await fetch(imageUrl);
      if (!resp.ok) return null;
      const buffer = await resp.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      return `data:image/png;base64,${base64}`;
    } catch (err) {
      this.logger.warn(`generateSwordImage failed: ${String(err)}`);
      return null;
    }
  }

  private getSwordWeaponType(sword: {
    element: string;
    tags: string[];
    dom: number;
    atk: number;
    def: number;
    spd: number;
  }): string {
    const tagCounts: Record<string, number> = {};
    for (const t of sword.tags) tagCounts[t] = (tagCounts[t] ?? 0) + 1;

    // 태그 기반 (가장 강한 특성)
    if ((tagCounts['soul'] ?? 0) >= 2) return 'spectral halberd';
    if ((tagCounts['dark'] ?? 0) >= 3) return 'dark scythe';
    if ((tagCounts['thunder'] ?? 0) >= 2) return 'lightning spear';
    if ((tagCounts['curse'] ?? 0) >= 3) return 'cursed crossbow';
    if ((tagCounts['light'] ?? 0) >= 3) return 'holy lance';
    if ((tagCounts['combat'] ?? 0) >= 3) return 'great sword';

    // 스탯 기반
    if (sword.spd >= 22 && sword.atk < 30) return 'elegant bow';
    if (sword.def >= 28) return 'broad sword and shield';
    if (sword.atk >= 40) return 'massive two-handed sword';

    // 원소 기반
    switch (sword.element) {
      case 'fire':
        return 'flamberge flame sword';
      case 'ice':
        return 'frost crystal lance';
      case 'thunder':
        return 'lightning blade';
      case 'dark':
        return sword.dom >= 5 ? 'death scythe' : 'dark curved sword';
      case 'light':
        return 'holy sword';
      case 'wind':
        return 'feathered wind blade';
      case 'poison':
        return 'venom rapier';
      case 'water':
        return 'wave blade';
      default:
        return 'straight knightly sword';
    }
  }

  private getElementColorDesc(element: string): string {
    const map: Record<string, string> = {
      fire: 'red orange glowing',
      ice: 'blue crystalline frost',
      thunder: 'yellow electric lightning',
      dark: 'dark purple shadowy',
      light: 'golden radiant holy',
      wind: 'green translucent',
      poison: 'sickly green toxic',
      water: 'blue flowing',
      neutral: 'silver metallic',
    };
    return map[element] ?? 'silver metallic';
  }
}
