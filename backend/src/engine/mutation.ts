import type { SkillEffect, StatusEffect } from '../shared/types/game.types';

// ─── 변이 결과 ────────────────────────────────────────────────────────────────

export interface MutationResult {
  augmentedEffect: SkillEffect;
  mutatedName?: string;
  stbCostPerUse?: number;
}

// ─── 태그 변이 정의 ────────────────────────────────────────────────────────────

interface TagMutationDef {
  /** 어떤 스킬에 적용되는지 */
  appliesTo: 'attack' | 'element';
  /** appliesTo === 'element' 일 때 비교할 속성 */
  element?: string;
  /** 태그 수 ≥1 효과 */
  threshold1: {
    damageMult?: number;
    extraDebuff?: StatusEffect;
    debuffDuration?: number;
    stbCostPerUse?: number;
  };
  /** 태그 수 ≥3 효과 (없으면 threshold1 재사용) */
  threshold3?: {
    damageMult?: number;
    extraDebuff?: StatusEffect;
    debuffDuration?: number;
    stbCostPerUse?: number;
    namePrefix?: string;
  };
}

const TAG_MUTATIONS: Record<string, TagMutationDef> = {
  // ── 저주 빌드 (CURSED_BLADE, SOUL_FRAGMENT, DEMON_EYE → 최대 ×3) ──────────
  curse: {
    appliesTo: 'attack',
    threshold1: { damageMult: 1.15 },
    threshold3: { damageMult: 1.30, stbCostPerUse: 1, namePrefix: '저주받은 ' },
  },
  // ── 어둠 빌드 (SHADOW_CRYSTAL + 저주계 → 최대 ×4+) ───────────────────────
  dark: {
    appliesTo: 'element',
    element: 'dark',
    threshold1: { damageMult: 1.20 },
    threshold3: { damageMult: 1.35, extraDebuff: 'blind', debuffDuration: 2, namePrefix: '어둠에 잠식된 ' },
  },
  // ── 전투 빌드 (IRON_SHARD, GUARD_STONE, SWIFT_FEATHER → 최대 ×3) ─────────
  combat: {
    appliesTo: 'attack',
    threshold1: { damageMult: 1.10 },
    threshold3: { damageMult: 1.20, namePrefix: '전장의 ' },
  },
  // ── 불꽃 빌드 (EMBER_STONE → 최대 ×1) ────────────────────────────────────
  fire: {
    appliesTo: 'element',
    element: 'fire',
    threshold1: { damageMult: 1.15, extraDebuff: 'burn', debuffDuration: 1 },
  },
  // ── 냉기 빌드 (FROST_SHARD → 최대 ×1) ───────────────────────────────────
  ice: {
    appliesTo: 'element',
    element: 'ice',
    threshold1: { damageMult: 1.15, extraDebuff: 'slow', debuffDuration: 1 },
  },
  // ── heat (EMBER_STONE 보조 태그, fire 빌드 보강) ──────────────────────────
  heat: {
    appliesTo: 'element',
    element: 'fire',
    threshold1: { damageMult: 1.05 },
  },
  // ── cold (FROST_SHARD 보조 태그) ──────────────────────────────────────────
  cold: {
    appliesTo: 'element',
    element: 'ice',
    threshold1: { damageMult: 1.05 },
  },
};

// ─── 유틸: 태그 카운트 맵 ─────────────────────────────────────────────────────

/**
 * tags 배열에서 각 태그의 등장 횟수를 센다.
 * e.g. ['curse','dark','curse','risk'] → { curse: 2, dark: 1, risk: 1 }
 */
export function buildTagMap(tags: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const tag of tags) {
    map[tag] = (map[tag] ?? 0) + 1;
  }
  return map;
}

// ─── 핵심: 스킬 변이 계산 ─────────────────────────────────────────────────────

/**
 * 검이 보유한 tagMap을 기반으로 스킬 효과를 증강하고 변이 이름을 반환한다.
 *
 * @param skillElement  스킬의 속성 ('fire', 'ice', 'dark', ...)
 * @param effect        원래 SkillEffect
 * @param skillAiName   스킬 UI 표시 이름 (변이 접두어 붙일 대상)
 * @param tagMap        buildTagMap() 결과
 */
export function computeSkillMutation(
  skillElement: string,
  effect: SkillEffect,
  skillAiName: string,
  tagMap: Record<string, number>,
): MutationResult {
  let augmented: SkillEffect = { ...effect };
  let mutatedName: string | undefined;
  let stbCostPerUse = 0;

  for (const [tag, def] of Object.entries(TAG_MUTATIONS)) {
    const count = tagMap[tag] ?? 0;
    if (count === 0) continue;

    // 이 태그가 현재 스킬에 적용되는지 확인
    const isAttackSkill = !!(augmented.damageMultiplier || augmented.aoeMultiplier);
    const applies =
      (def.appliesTo === 'attack' && isAttackSkill) ||
      (def.appliesTo === 'element' && skillElement === def.element);

    if (!applies) continue;

    // 임계값 선택: ≥3이면 threshold3, 아니면 threshold1
    const thr = count >= 3 && def.threshold3 ? def.threshold3 : def.threshold1;

    // ① 데미지 배율 곱연산 증폭
    if (thr.damageMult) {
      if (augmented.damageMultiplier) {
        augmented.damageMultiplier = round2(augmented.damageMultiplier * thr.damageMult);
      }
      if (augmented.aoeMultiplier) {
        augmented.aoeMultiplier = round2(augmented.aoeMultiplier * thr.damageMult);
      }
    }

    // ② 추가 디버프 (스킬에 디버프 없을 때만 부여)
    if (thr.extraDebuff && !augmented.debuff) {
      augmented.debuff = thr.extraDebuff;
      augmented.debuffDuration = thr.debuffDuration ?? 1;
    }

    // ③ STB 소모
    if (thr.stbCostPerUse) {
      stbCostPerUse += thr.stbCostPerUse;
    }

    // ④ 변이 이름 (≥3 && namePrefix 있을 때만)
    if (count >= 3 && def.threshold3?.namePrefix && !mutatedName) {
      mutatedName = `${def.threshold3.namePrefix}${skillAiName}`;
    }
  }

  return {
    augmentedEffect: augmented,
    mutatedName,
    stbCostPerUse: stbCostPerUse > 0 ? stbCostPerUse : undefined,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
