import { Injectable } from '@nestjs/common';
import type { Element } from '../shared/types/game.types';
import {
  ELEMENT_ADVANTAGE,
  ELEMENT_DAMAGE_BONUS,
  ELEMENT_DAMAGE_PENALTY,
} from '../shared/constants/game.constants';

@Injectable()
export class ElementEngine {
  /**
   * 공격 속성 vs 방어 속성 상성 배율 반환
   * @returns 1.2 (강함) | 0.8 (약함) | 1.0 (중립)
   */
  getMultiplier(attackerElement: Element, defenderElement: Element): number {
    const attackerAdv = ELEMENT_ADVANTAGE[attackerElement] ?? [];
    if (attackerAdv.includes(defenderElement)) {
      return 1 + ELEMENT_DAMAGE_BONUS; // 1.2
    }

    // 역방향 체크 (방어자가 공격자에게 강함 → 공격자 약함)
    const defenderAdv = ELEMENT_ADVANTAGE[defenderElement] ?? [];
    if (defenderAdv.includes(attackerElement)) {
      return 1 + ELEMENT_DAMAGE_PENALTY; // 0.8
    }

    return 1.0;
  }

  /**
   * 피해 계산에 속성 배율 적용
   */
  applyElementMultiplier(
    baseDamage: number,
    attackerElement: Element,
    defenderElement: Element,
  ): number {
    const multiplier = this.getMultiplier(attackerElement, defenderElement);
    return Math.round(baseDamage * multiplier);
  }
}
