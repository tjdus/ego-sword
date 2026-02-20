import { Injectable } from '@nestjs/common';
import type {
  Element,
  OwnerClass,
  CompatBreakdown,
  SwordStats,
  OwnerCombatStats,
  OwnerPersonalityStats,
} from '../shared/types/game.types';
import {
  CLASS_BASE_COMPAT,
  CLASS_ELEMENT_COMPAT,
  COMPAT_DOM_PENALTY_PER_DOM,
  COMPAT_PALADIN_STB_BONUS,
  COMPAT_ROGUE_SPD_BONUS,
  COMPAT_HUNTER_SPD_BONUS,
  COMPAT_BERSERKER_STB_PENALTY,
} from '../shared/constants/game.constants';

@Injectable()
export class CompatibilityEngine {
  /**
   * 조화 점수 계산
   * = clamp(직업궁합 + 속성궁합 + 성향궁합 + 스탯상호보정 - 지배패널티, 0, 100)
   */
  calculate(
    ownerClass: OwnerClass,
    ownerElement: Element,
    swordElement: Element,
    sword: SwordStats,
    ownerCombat: OwnerCombatStats,
    ownerPersonality: OwnerPersonalityStats,
  ): CompatBreakdown {
    const classCompat = this.calcClassCompat(ownerClass, sword);
    const elementCompat = this.calcElementCompat(ownerClass, swordElement, ownerElement);
    const personalityCompat = this.calcPersonalityCompat(ownerPersonality, sword);
    const statCompat = this.calcStatCompat(sword, ownerCombat);
    const domPenalty = sword.dom * COMPAT_DOM_PENALTY_PER_DOM;

    const raw = classCompat + elementCompat + personalityCompat + statCompat - domPenalty;
    const total = Math.min(100, Math.max(0, Math.round(raw)));

    return { classCompat, elementCompat, personalityCompat, statCompat, domPenalty, total };
  }

  // ── A) 직업궁합 (0~35) ───────────────────────────────────────────────────

  private calcClassCompat(ownerClass: OwnerClass, sword: SwordStats): number {
    let base = CLASS_BASE_COMPAT[ownerClass];

    switch (ownerClass) {
      case 'paladin':
        if (sword.stb >= COMPAT_PALADIN_STB_BONUS.threshold) {
          base += COMPAT_PALADIN_STB_BONUS.bonus;
        }
        break;
      case 'rogue':
        if (sword.spd >= COMPAT_ROGUE_SPD_BONUS.threshold) {
          base += COMPAT_ROGUE_SPD_BONUS.bonus;
        }
        break;
      case 'hunter':
        if (sword.spd >= COMPAT_HUNTER_SPD_BONUS.threshold) {
          base += COMPAT_HUNTER_SPD_BONUS.bonus;
        }
        break;
      case 'berserker':
        if (sword.stb < COMPAT_BERSERKER_STB_PENALTY.threshold) {
          base -= COMPAT_BERSERKER_STB_PENALTY.penalty;
        }
        break;
    }

    return Math.min(35, Math.max(0, base));
  }

  // ── B) 속성궁합 (0~30) ───────────────────────────────────────────────────

  private calcElementCompat(
    ownerClass: OwnerClass,
    swordElement: Element,
    _ownerElement: Element,
  ): number {
    const table = CLASS_ELEMENT_COMPAT[ownerClass];

    // 마법사는 속성 일치 시 25, 불일치 시 5
    if (ownerClass === 'mage') {
      return swordElement === _ownerElement ? 25 : 5;
    }

    const score = table[swordElement] ?? table['default'] ?? 5;
    return Math.min(30, Math.max(0, score));
  }

  // ── C) 성향궁합 (0~20) ───────────────────────────────────────────────────

  private calcPersonalityCompat(
    personality: OwnerPersonalityStats,
    sword: SwordStats,
  ): number {
    let score = 0;

    // 신중한 주인 + 불안정한 검 → 안정화 시너지
    if (personality.caut >= 7 && sword.stb <= 8) {
      score += 10;
    }

    // 탐욕 높은 주인 + 어둠/저주 태그 많은 검 → 위험 즐김
    // (태그 정보는 별도 파라미터로 받아야 하지만, 여기선 DOM으로 근사)
    if (personality.greed >= 7 && sword.dom >= 3) {
      score += 8;
    }

    // 탐지 높은 주인 → 탐험 성향 시너지 (STB 안정성과 연계)
    if (personality.det >= 7 && sword.stb >= 12) {
      score += 8;
    }

    // 자비 높은 주인 + 안정적인 검
    if (personality.mercy >= 7 && sword.stb >= 12) {
      score += 4;
    }

    return Math.min(20, Math.max(0, score));
  }

  // ── D) 스탯 상호보정 (0~15) ──────────────────────────────────────────────

  private calcStatCompat(
    sword: SwordStats,
    owner: OwnerCombatStats,
  ): number {
    let score = 0;

    // 주인 AGI 높고 검 SPD 높으면 → 연계 잘 됨
    if (owner.agi >= 12 && sword.spd >= 12) {
      score += 5;
    }

    // 주인 FOCUS 높고 검이 제어 중심 → 상태이상 성공률 상승 시너지
    if (owner.focus >= 14 && sword.spd >= 10) {
      score += 5;
    }

    // 주인 HP 낮고 검 DEF 높으면 → 보호 역할 시너지
    if (owner.hpMax <= 70 && sword.def >= 12) {
      score += 5;
    }

    return Math.min(15, Math.max(0, score));
  }
}
