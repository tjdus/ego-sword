import { Injectable } from '@nestjs/common';
import type { SwordStats } from '../shared/types/game.types';
import {
  MAGIC_SWORD_DOM_THRESHOLD,
  MAGIC_SWORD_ACTION_SYNC_COST,
  MAGIC_SWORD_STB_DRAIN_PER_TURN,
  MAGIC_SWORD_EVENT_FAIL_BONUS,
} from '../shared/constants/game.constants';

export type MagicSwordAction = 'force' | 'retry';
export type ForceActionType = 'attack' | 'defend' | 'skill';

export interface MagicSwordActivationResult {
  isMagicSword: boolean;
  syncAfter: number;
  stbDrain: number;      // 턴 종료 STB -1
  eventFailBonus: number; // 탐험 이벤트 실패 확률 추가 (%)
}

@Injectable()
export class MagicSwordEngine {
  /**
   * 현재 DOM 기준 마검 상태 여부
   */
  isMagicSword(dom: number): boolean {
    return dom >= MAGIC_SWORD_DOM_THRESHOLD;
  }

  /**
   * 마검 행동 적용 (강제 or 재시도)
   * - 비용: SYNC -2
   * - 턴 종료 시 STB -1 (별도 applyTurnEnd에서)
   */
  applyAction(
    sword: SwordStats,
    action: MagicSwordAction,
  ): { syncAfter: number; valid: boolean } {
    if (!this.isMagicSword(sword.dom)) {
      return { syncAfter: sword.sync, valid: false };
    }
    const syncAfter = Math.max(0, sword.sync - MAGIC_SWORD_ACTION_SYNC_COST);
    return { syncAfter, valid: true };
  }

  /**
   * 턴 종료 마검 패널티 적용
   * - STB -1 (최소 1 강제)
   */
  applyTurnEnd(sword: SwordStats): { stbAfter: number; eventFailBonus: number } {
    if (!this.isMagicSword(sword.dom)) {
      return { stbAfter: sword.stb, eventFailBonus: 0 };
    }
    const stbAfter = Math.max(1, sword.stb - MAGIC_SWORD_STB_DRAIN_PER_TURN);
    return { stbAfter, eventFailBonus: MAGIC_SWORD_EVENT_FAIL_BONUS };
  }

  /**
   * DOM 증가 후 마검 상태 전환 체크
   */
  checkTransition(currentDom: number, addedDom: number): boolean {
    const newDom = Math.min(10, currentDom + addedDom);
    const wasActive = this.isMagicSword(currentDom);
    const isActive = this.isMagicSword(newDom);
    return !wasActive && isActive; // 이번에 처음 마검 상태 진입
  }
}
