import { Injectable } from '@nestjs/common';
import type { OwnerClass } from '../shared/types/game.types';

// ─── 트리거 규칙 정의 ─────────────────────────────────────────────────────────

type TagCondition =
  | { type: 'single'; tag: string; minCount: number }
  | { type: 'combo'; tags: [string, string]; minCountEach: number };

export type TriggerOutcome =
  | { type: 'skill_acquire'; skillId: string }
  | { type: 'skill_upgrade'; from: string; to: string }
  | { type: 'stat_boost'; stat: 'atk' | 'def' | 'spd' | 'stb'; amount: number }
  | { type: 'sync_restore'; amount: number };

interface TriggerRule {
  id: string;
  condition: TagCondition;
  probability: number;             // 0.0~1.0
  ownerBonus?: { class: OwnerClass; bonus: number };
  compatBonus?: { minCompat: number; bonus: number };
  outcome: TriggerOutcome;
  once: boolean;                   // true: 런당 1회만
}

export interface TriggerResult {
  ruleId: string;
  outcome: TriggerOutcome;
  description: string;
}

// ─── 트리거 룰 테이블 ─────────────────────────────────────────────────────────

const TRIGGER_RULES: TriggerRule[] = [
  // curse×3 + dark×3 공존 → 40% → SK_SOUL_REAP 획득 (런당 1회)
  {
    id: 'DARK_CURSE_CONVERGENCE',
    condition: { type: 'combo', tags: ['curse', 'dark'], minCountEach: 3 },
    probability: 0.4,
    outcome: { type: 'skill_acquire', skillId: 'SK_SOUL_REAP' },
    once: true,
  },
  // thunder×2 → 50% (hunter +20%) → SK_LIGHTNING_BOLT 획득 (런당 1회)
  {
    id: 'THUNDER_AWAKENING',
    condition: { type: 'single', tag: 'thunder', minCount: 2 },
    probability: 0.5,
    ownerBonus: { class: 'hunter', bonus: 0.2 },
    outcome: { type: 'skill_acquire', skillId: 'SK_LIGHTNING_BOLT' },
    once: true,
  },
  // combat×3 + compat≥70 → 35% → atk +3 (런당 1회)
  {
    id: 'WARRIOR_BOND',
    condition: { type: 'single', tag: 'combat', minCount: 3 },
    probability: 0.35,
    compatBonus: { minCompat: 70, bonus: 0.15 },
    outcome: { type: 'stat_boost', stat: 'atk', amount: 3 },
    once: true,
  },
  // soul×2 → 30% → sync +3 (반복 가능)
  {
    id: 'SOUL_HARVEST',
    condition: { type: 'single', tag: 'soul', minCount: 2 },
    probability: 0.3,
    outcome: { type: 'sync_restore', amount: 3 },
    once: false,
  },
  // light×3 → 35% → stb +2 (런당 1회)
  {
    id: 'HOLY_BLESSING',
    condition: { type: 'single', tag: 'light', minCount: 3 },
    probability: 0.35,
    ownerBonus: { class: 'paladin', bonus: 0.2 },
    outcome: { type: 'stat_boost', stat: 'stb', amount: 2 },
    once: true,
  },
  // berserker×2 → 40% (berserker +20%) → SK_BERSERK_CHARGE 획득 (런당 1회)
  {
    id: 'BERSERKER_RAGE',
    condition: { type: 'single', tag: 'berserker', minCount: 2 },
    probability: 0.4,
    ownerBonus: { class: 'berserker', bonus: 0.2 },
    outcome: { type: 'skill_acquire', skillId: 'SK_BERSERK_CHARGE' },
    once: true,
  },
];

// ─── 트리거 엔진 ──────────────────────────────────────────────────────────────

@Injectable()
export class TriggerEngine {
  checkTriggers(
    tagMap: Record<string, number>,
    firedIds: string[],
    ownerClass: OwnerClass,
    compatScore: number,
    currentSkillIds: string[],
    random: () => number = Math.random,
  ): TriggerResult[] {
    const results: TriggerResult[] = [];

    for (const rule of TRIGGER_RULES) {
      // once: 이미 발동한 트리거 건너뜀
      if (rule.once && firedIds.includes(rule.id)) continue;

      // 스킬 획득 트리거: 이미 보유 중이면 건너뜀
      if (rule.outcome.type === 'skill_acquire') {
        if (currentSkillIds.includes(rule.outcome.skillId)) continue;
      }

      // 조건 검사
      if (!this.checkCondition(rule.condition, tagMap)) continue;

      // 확률 계산
      let prob = rule.probability;
      if (rule.ownerBonus && ownerClass === rule.ownerBonus.class) {
        prob = Math.min(1.0, prob + rule.ownerBonus.bonus);
      }
      if (rule.compatBonus && compatScore >= rule.compatBonus.minCompat) {
        prob = Math.min(1.0, prob + rule.compatBonus.bonus);
      }

      if (random() >= prob) continue;

      results.push({
        ruleId: rule.id,
        outcome: rule.outcome,
        description: this.describeOutcome(rule.outcome),
      });
    }

    return results;
  }

  private checkCondition(
    condition: TagCondition,
    tagMap: Record<string, number>,
  ): boolean {
    if (condition.type === 'single') {
      return (tagMap[condition.tag] ?? 0) >= condition.minCount;
    }
    // combo: 두 태그 모두 minCountEach 이상
    const [tagA, tagB] = condition.tags;
    return (
      (tagMap[tagA] ?? 0) >= condition.minCountEach &&
      (tagMap[tagB] ?? 0) >= condition.minCountEach
    );
  }

  private describeOutcome(outcome: TriggerOutcome): string {
    switch (outcome.type) {
      case 'skill_acquire':
        return `새 스킬 획득: ${outcome.skillId}`;
      case 'skill_upgrade':
        return `스킬 업그레이드: ${outcome.from} → ${outcome.to}`;
      case 'stat_boost':
        return `${outcome.stat.toUpperCase()} +${outcome.amount}`;
      case 'sync_restore':
        return `SYNC 최대치 +${outcome.amount}`;
    }
  }
}
