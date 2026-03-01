import { Injectable } from '@nestjs/common';

export interface ItemTemplateLike {
  id: string;
  rarity: string;
  effectJson: unknown;
}

// 층 → 허용 레어리티
const FLOOR_RARITY_POOL: Record<number, string[]> = {
  1: ['common', 'rare'],
  2: ['common', 'rare', 'epic'],
  3: ['rare', 'epic'],
};

@Injectable()
export class RewardEngine {
  /**
   * 전투 승리 시 드롭 아이템 결정
   * - 1개 드롭: 75%
   * - 2개 드롭: 35%
   * - 3개 드롭: 10%
   * - 이미 흡수한 아이템 제외
   * - 층에 따른 레어리티 풀 적용
   */
  generateBattleDrops(
    floor: number,
    absorbedItemIds: string[],
    allItems: ItemTemplateLike[],
    random: () => number = Math.random,
  ): string[] {
    const allowedRarities = FLOOR_RARITY_POOL[floor] ?? FLOOR_RARITY_POOL[1];

    // 획득 가능 아이템 풀 (이미 흡수한 것 제외, 레어리티 필터)
    const pool = allItems.filter(
      item =>
        !absorbedItemIds.includes(item.id) &&
        allowedRarities.includes(item.rarity),
    );

    if (pool.length === 0) return [];

    // 드롭 수 결정
    let dropCount = 0;
    if (random() < 0.75) dropCount = 1;
    if (random() < 0.35) dropCount = 2;
    if (random() < 0.10) dropCount = 3;

    if (dropCount === 0) return [];

    // 중복 없이 랜덤 선택
    const shuffled = [...pool].sort(() => random() - 0.5);
    return shuffled.slice(0, Math.min(dropCount, shuffled.length)).map(i => i.id);
  }
}
