import { Injectable } from '@nestjs/common';
import type { SwordStats, OwnerCombatStats } from '../shared/types/game.types';
import {
  OVERDRIVE_THRESHOLD_STB,
  OVERDRIVE_PROB_PER_STB,
  OVERDRIVE_ATK_BONUS,
  OVERDRIVE_SYNC_RESTORE,
  OVERDRIVE_OWNER_HP_COST_RATIO,
  OVERDRIVE_MISJUDGE_BONUS,
} from '../shared/constants/game.constants';

export interface OverdriveResult {
  triggered: boolean;
  atkMultiplier: number;       // 1.0 또는 1.25
  syncBonus: number;           // 0 또는 1
  ownerHpDrain: number;        // 주인 HP 감소량
  misjudgeBonus: number;       // 오판 확률 추가 (%)
  isOwnerHpDrain: boolean;     // true: HP drain, false: misjudge
}

@Injectable()
export class OverdriveEngine {
  /**
   * 턴 종료 시 폭주 체크
   * 폭주확률 = max(0, (8 - STB)) * 5%
   */
  check(
    sword: SwordStats,
    owner: OwnerCombatStats,
    random: () => number = Math.random,
  ): OverdriveResult {
    const probability = Math.max(0, (OVERDRIVE_THRESHOLD_STB - sword.stb)) * OVERDRIVE_PROB_PER_STB / 100;

    if (probability <= 0 || random() >= probability) {
      return {
        triggered: false,
        atkMultiplier: 1.0,
        syncBonus: 0,
        ownerHpDrain: 0,
        misjudgeBonus: 0,
        isOwnerHpDrain: false,
      };
    }

    // 폭주 발동 — 단점은 50% 확률로 HP drain vs misjudge
    const isOwnerHpDrain = random() < 0.5;
    const ownerHpDrain = isOwnerHpDrain
      ? Math.floor(owner.hpMax * OVERDRIVE_OWNER_HP_COST_RATIO)
      : 0;

    return {
      triggered: true,
      atkMultiplier: OVERDRIVE_ATK_BONUS,
      syncBonus: OVERDRIVE_SYNC_RESTORE,
      ownerHpDrain,
      misjudgeBonus: isOwnerHpDrain ? 0 : OVERDRIVE_MISJUDGE_BONUS,
      isOwnerHpDrain,
    };
  }

  /**
   * 현재 STB 기준 폭주 확률 (UI 표시용)
   */
  getProbability(stb: number): number {
    return Math.max(0, (OVERDRIVE_THRESHOLD_STB - stb)) * OVERDRIVE_PROB_PER_STB;
  }
}
