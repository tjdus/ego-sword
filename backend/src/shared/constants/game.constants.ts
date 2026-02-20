import type { Element, OwnerClass } from '../types/game.types';

// ─── 검 기본 스탯 (낡은 검) ───────────────────────────────────────────────────

export const SWORD_DEFAULT_STATS = {
  atk: 10,
  def: 5,
  spd: 8,
  sync: 8,
  syncMax: 8,
  stb: 10,
  dom: 0,
  element: 'neutral' as Element,
} as const;

export const SWORD_STAT_RANGES = {
  atk:  { min: 5,  max: 60 },
  def:  { min: 0,  max: 40 },
  spd:  { min: 0,  max: 30 },
  sync: { min: 0,  max: 20 },
  stb:  { min: 1,  max: 20 },  // 최소 1 강제 (0 방지)
  dom:  { min: 0,  max: 10 },
} as const;

// ─── STB 폭주 (Overdrive) 규칙 ───────────────────────────────────────────────

export const OVERDRIVE_THRESHOLD_STB = 8;  // 이하면 폭주 확률 발생
export const OVERDRIVE_PROB_PER_STB = 5;   // 부족한 STB 1당 +5%
export const OVERDRIVE_ATK_BONUS = 1.25;   // ATK × 1.25
export const OVERDRIVE_SYNC_RESTORE = 1;   // SYNC +1
export const OVERDRIVE_OWNER_HP_COST_RATIO = 0.06; // 주인 최대HP의 6%
export const OVERDRIVE_MISJUDGE_BONUS = 15; // 오판 확률 +15%

// ─── DOM / 마검 규칙 ─────────────────────────────────────────────────────────

export const MAGIC_SWORD_DOM_THRESHOLD = 5;
export const MAGIC_SWORD_ACTION_SYNC_COST = 2;  // 강제/재시도 1회 SYNC -2
export const MAGIC_SWORD_STB_DRAIN_PER_TURN = 1; // 매 턴 STB -1
export const MAGIC_SWORD_EVENT_FAIL_BONUS = 10;  // 탐험 이벤트 실패 +10%

// ─── 조화 점수 가중치 ─────────────────────────────────────────────────────────

export const COMPAT_DOM_PENALTY_PER_DOM = 6;

export const CLASS_BASE_COMPAT: Record<OwnerClass, number> = {
  warrior:   30,
  mage:      20,
  paladin:   25,
  rogue:     22,
  hunter:    22,
  berserker: 28,
};

// 조화 보정 조건
export const COMPAT_PALADIN_STB_BONUS = { threshold: 12, bonus: 5 };
export const COMPAT_ROGUE_SPD_BONUS   = { threshold: 15, bonus: 5 };
export const COMPAT_HUNTER_SPD_BONUS  = { threshold: 12, bonus: 5 };
export const COMPAT_BERSERKER_STB_PENALTY = { threshold: 8, penalty: 5 };

// 속성 궁합 (직업별 선호 속성 → 점수)
export const CLASS_ELEMENT_COMPAT: Record<OwnerClass, Partial<Record<Element | 'default', number>>> = {
  warrior:   { default: 8 },  // 속성 무관
  mage:      { default: 5 },  // 일치 시 25, 아래 로직에서 처리
  paladin:   { light: 20, dark: 0, default: 10 },
  rogue:     { poison: 15, dark: 12, default: 5 },
  hunter:    { wind: 15, thunder: 12, default: 5 },
  berserker: { fire: 15, dark: 12, default: 8 },
};

// 조화 구간 효과
export const COMPAT_HIGH_THRESHOLD = 70;
export const COMPAT_LOW_THRESHOLD  = 30;

// ─── 속성 상성 (강함: +20%, 약함: -20%) ─────────────────────────────────────

export const ELEMENT_ADVANTAGE: Record<Element, Element[]> = {
  fire:    ['wind', 'ice'],
  water:   ['fire', 'poison'],
  ice:     ['wind', 'water'],
  thunder: ['water', 'wind'],
  wind:    [],
  poison:  ['wind', 'neutral'],
  light:   ['dark'],
  dark:    ['light'],
  neutral: [],
};

export const ELEMENT_DAMAGE_BONUS = 0.20;    // 강함: +20%
export const ELEMENT_DAMAGE_PENALTY = -0.20; // 약함: -20%

// ─── SYNC 회복 (턴 종료) ─────────────────────────────────────────────────────

export const SYNC_RECOVERY_BASE = 2;
export const SYNC_RECOVERY_HIGH_COMPAT = 3;  // 조화≥70이면 +3

// ─── 특성 softcap ────────────────────────────────────────────────────────────

export const TRAIT_SOFTCAP_EFFECT_RATIO = 0.5; // softcap 이상부터 효과 절반

// ─── 던전 구조 ───────────────────────────────────────────────────────────────

export const DUNGEON_FLOORS = 3;
export const ROOMS_PER_FLOOR = 6;

// 깊이별 강한 주인 출현 확률 (0~1)
export const STRONG_OWNER_PROB_BY_FLOOR: Record<number, number> = {
  1: 0.10,
  2: 0.30,
  3: 0.50,
};

// ─── 주인 성향 스탯 가중치 (평균값, σ=2) ─────────────────────────────────────

export const OWNER_PERSONALITY_WEIGHTS: Record<OwnerClass, Record<string, number>> = {
  warrior:   { det: 3, greed: 4, bold: 8, caut: 3, mercy: 5 },
  mage:      { det: 7, greed: 3, bold: 5, caut: 6, mercy: 5 },
  paladin:   { det: 4, greed: 2, bold: 5, caut: 7, mercy: 9 },
  rogue:     { det: 9, greed: 8, bold: 6, caut: 4, mercy: 3 },
  hunter:    { det: 8, greed: 5, bold: 6, caut: 7, mercy: 4 },
  berserker: { det: 2, greed: 5, bold: 10, caut: 1, mercy: 3 },
};

// ─── 탐험 확률 기본값 ─────────────────────────────────────────────────────────

export const EXPLORE_TRAP_BASE = 0.20;
export const EXPLORE_TRAP_DET_BONUS = 0.015;
export const EXPLORE_TRAP_GREED_PENALTY = 0.005;

export const EXPLORE_TREASURE_BASE = 0.10;
export const EXPLORE_TREASURE_GREED_BONUS = 0.012;
export const EXPLORE_TREASURE_COMPAT_BONUS = 0.05; // 조화≥70

export const EXPLORE_DANGER_BASE = 0.03;
export const EXPLORE_DANGER_BOLD_BONUS = 0.008;
export const EXPLORE_DANGER_LOW_STB_BONUS = 0.05; // STB<8
