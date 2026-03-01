import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── 스킬 템플릿 20개 ──────────────────────────────────────────────────────

  await prisma.skillTemplate.createMany({
    skipDuplicates: true,
    data: [
      // 공격-단일 (6개)
      { id: 'SK_ICE_PIERCE', type: 'attack', category: 'single', cost: 3, element: 'ice', tags: ['pierce', 'cold'], effectJson: { damageMultiplier: 1.4, debuff: 'slow', debuffDuration: 2 }, aiName: '서늘한 예기의 찌르기', aiDesc: '칼끝의 냉기가 관통해, 숨을 느리게 만든다.', aiVfxKeywords: ['차가운 파편', '얇은 김', '하얀 잔상'], aiQuote: '조용히….' },
      { id: 'SK_FIRE_SLASH', type: 'attack', category: 'single', cost: 2, element: 'fire', tags: ['slash', 'burn'], effectJson: { damageMultiplier: 1.2, debuff: 'burn', debuffDuration: 2 }, aiName: '불꽃 베기', aiDesc: '타오르는 칼날이 적을 가른다.', aiVfxKeywords: ['붉은 불꽃', '열기'], aiQuote: '타올라라.' },
      { id: 'SK_DARK_CUT', type: 'attack', category: 'single', cost: 2, element: 'dark', tags: ['cut', 'dark'], effectJson: { damageMultiplier: 1.3 }, riskJson: { domChange: 1 }, aiName: '어둠의 참격', aiDesc: '어둠이 깃든 참격. 검이 더 강해진다.', aiVfxKeywords: ['검은 섬광', '어둠 잔상'], aiQuote: '…내가 움직인다.' },
      { id: 'SK_THUNDER_STRIKE', type: 'attack', category: 'single', cost: 3, element: 'thunder', tags: ['strike', 'lightning'], effectJson: { damageMultiplier: 1.5, debuff: 'stun', debuffDuration: 1 }, aiName: '번개 강타', aiDesc: '번개처럼 빠른 일격이 적을 마비시킨다.', aiVfxKeywords: ['번개', '마비 효과'], aiQuote: '쏴!' },
      { id: 'SK_POISON_JAB', type: 'attack', category: 'single', cost: 2, element: 'poison', tags: ['jab', 'poison'], effectJson: { damageMultiplier: 0.9, debuff: 'poison', debuffDuration: 3 }, aiName: '독 찌르기', aiDesc: '빠른 찌르기로 독을 주입한다.', aiVfxKeywords: ['보라 독기', '찌름'], aiQuote: '천천히….' },
      { id: 'SK_LIGHT_SMITE', type: 'attack', category: 'single', cost: 3, element: 'light', tags: ['smite', 'holy'], effectJson: { damageMultiplier: 1.6 }, aiName: '신성한 심판', aiDesc: '빛이 응집되어 적을 강타한다.', aiVfxKeywords: ['황금빛', '성광'], aiQuote: '심판받아라.' },

      // 공격-광역 (3개)
      { id: 'SK_FIRE_SWEEP', type: 'attack', category: 'aoe', cost: 4, element: 'fire', tags: ['sweep', 'fire', 'aoe'], effectJson: { aoeMultiplier: 0.8, debuff: 'burn', debuffDuration: 1 }, aiName: '화염 휩쓸기', aiDesc: '불꽃이 퍼져나가 모든 것을 태운다.', aiVfxKeywords: ['폭발', '화염파'], aiQuote: '다 타버려라!' },
      { id: 'SK_THUNDER_STORM', type: 'attack', category: 'aoe', cost: 5, element: 'thunder', tags: ['storm', 'thunder', 'aoe'], effectJson: { aoeMultiplier: 1.0 }, aiName: '뇌운 폭풍', aiDesc: '번개가 난무하며 적들을 휩쓸어버린다.', aiVfxKeywords: ['번개 폭풍', '전격'], aiQuote: '으르렁….' },
      { id: 'SK_WIND_SPIRAL', type: 'attack', category: 'aoe', cost: 3, element: 'wind', tags: ['spiral', 'wind', 'aoe'], effectJson: { aoeMultiplier: 0.7, debuff: 'slow', debuffDuration: 1 }, aiName: '바람 소용돌이', aiDesc: '바람이 소용돌이쳐 적을 에워싼다.', aiVfxKeywords: ['회오리', '녹색 바람'], aiQuote: '흩어져라.' },

      // 공격-연쇄 (2개)
      { id: 'SK_CHAIN_BLADE', type: 'attack', category: 'chain', cost: 3, element: 'neutral', tags: ['chain', 'combo'], effectJson: { damageMultiplier: 0.7, extraTurn: true }, aiName: '연쇄 칼날', aiDesc: '연속 공격으로 추가 행동 기회를 얻는다.', aiVfxKeywords: ['연속 섬광', '잔상'], aiQuote: '이어서….' },
      { id: 'SK_COMBO_THRUST', type: 'attack', category: 'chain', cost: 4, element: 'neutral', tags: ['combo', 'thrust'], effectJson: { damageMultiplier: 1.0, extraTurn: true }, aiName: '연속 찌르기', aiDesc: '빠른 연속 공격 후 추가 행동.', aiVfxKeywords: ['빠른 움직임', '다중 잔상'], aiQuote: '끊지 마.' },

      // 방어 (3개)
      { id: 'SK_ICE_SHIELD', type: 'defense', category: 'shield', cost: 2, element: 'ice', tags: ['shield', 'ice'], effectJson: { shieldAmount: 15 }, aiName: '얼음 방벽', aiDesc: '얼음으로 방벽을 형성해 피해를 막는다.', aiVfxKeywords: ['얼음 결정', '푸른 방벽'], aiQuote: '막겠다.' },
      { id: 'SK_LIGHT_BARRIER', type: 'defense', category: 'shield', cost: 3, element: 'light', tags: ['barrier', 'light'], effectJson: { shieldAmount: 20, healAmount: 5 }, aiName: '신성 방벽', aiDesc: '빛의 방벽이 피해를 막고 회복한다.', aiVfxKeywords: ['황금 빛 방패', '치유 광채'], aiQuote: '지키겠다.' },
      { id: 'SK_STEEL_GUARD', type: 'defense', category: 'shield', cost: 1, element: 'neutral', tags: ['guard', 'steel'], effectJson: { shieldAmount: 8 }, aiName: '철갑 방어', aiDesc: '단단한 방어 자세로 피해를 흡수한다.', aiVfxKeywords: ['금속 반짝임', '방어 자세'], aiQuote: '….' },

      // 제어 (3개)
      { id: 'SK_FREEZE', type: 'control', category: 'debuff', cost: 3, element: 'ice', tags: ['freeze', 'control'], effectJson: { damageMultiplier: 0.5, debuff: 'freeze', debuffDuration: 1 }, aiName: '빙결', aiDesc: '적을 얼려 행동을 봉쇄한다.', aiVfxKeywords: ['얼음 결정', '빙결 효과'], aiQuote: '멈춰.' },
      { id: 'SK_POISON_SLOW', type: 'control', category: 'debuff', cost: 2, element: 'poison', tags: ['poison', 'slow'], effectJson: { debuff: 'slow', debuffDuration: 3 }, aiName: '독 안개', aiDesc: '독기를 퍼뜨려 적을 느리게 만든다.', aiVfxKeywords: ['보라 안개', '독기'], aiQuote: '천천히 가라앉아.' },
      { id: 'SK_BLIND', type: 'control', category: 'debuff', cost: 2, element: 'dark', tags: ['blind', 'dark'], effectJson: { debuff: 'blind', debuffDuration: 2 }, riskJson: { domChange: 1 }, aiName: '암흑', aiDesc: '어둠으로 적의 시야를 가린다.', aiVfxKeywords: ['암흑 구름', '시야 차단'], aiQuote: '아무것도 보이지 않겠지.' },

      // 자원 (2개)
      { id: 'SK_SYNC_PULSE', type: 'resource', category: 'sync', cost: 0, element: 'neutral', tags: ['sync', 'restore'], effectJson: { syncRestore: 4 }, aiName: '동조 파동', aiDesc: '영혼 연결을 강화하여 동조력을 회복한다.', aiVfxKeywords: ['파동', '연결 빛'], aiQuote: '이어지자.' },
      { id: 'SK_MEDITATION', type: 'resource', category: 'sync', cost: 1, element: 'neutral', tags: ['meditate', 'restore'], effectJson: { syncRestore: 6 }, aiName: '침묵', aiDesc: '잠시 멈춰 깊은 동조를 이루어낸다.', aiVfxKeywords: ['고요함', '내면의 빛'], aiQuote: '….' },

      // 리스크 (1개)
      { id: 'SK_OVERDRIVE_SURGE', type: 'risk', category: 'overdrive', cost: 1, element: 'neutral', tags: ['overdrive', 'risk'], effectJson: { damageMultiplier: 1.5 }, riskJson: { stbChange: -2, domChange: 1 }, aiName: '폭주 개방', aiDesc: '안정을 희생해 폭발적인 힘을 끌어낸다.', aiVfxKeywords: ['붉은 기운', '균열'], aiQuote: '상관없어.' },

      // ─── 업그레이드/획득 스킬 10개 ──────────────────────────────────────────

      // curse×3 업그레이드: SK_BASIC_SLASH → SK_CURSED_SLASH
      { id: 'SK_CURSED_SLASH', type: 'attack', category: 'single', cost: 3, element: 'dark', tags: ['slash', 'curse', 'dark'], effectJson: { damageMultiplier: 1.4 }, riskJson: { domChange: 1 }, aiName: '저주받은 참격', aiDesc: '저주가 응집된 칼날이 영혼까지 베어낸다.', aiVfxKeywords: ['검보라 균열', '저주 잔상'], aiQuote: '이게 진짜 나야.' },

      // combat×3 업그레이드: SK_BASIC_SLASH → SK_BATTLE_CRY
      { id: 'SK_BATTLE_CRY', type: 'attack', category: 'single', cost: 2, element: 'neutral', tags: ['slash', 'combat', 'war'], effectJson: { damageMultiplier: 1.3, stbRestore: 1 }, aiName: '전장의 함성', aiDesc: '전투를 거듭한 검이 울부짖는다. 안정이 돌아온다.', aiVfxKeywords: ['강렬한 섬광', '전투 기운'], aiQuote: '아직 끝나지 않았어.' },

      // dark×3 업그레이드: SK_FREEZE → SK_DARK_FREEZE
      { id: 'SK_DARK_FREEZE', type: 'control', category: 'debuff', cost: 3, element: 'dark', tags: ['freeze', 'dark', 'curse'], effectJson: { damageMultiplier: 0.6, debuff: 'freeze', debuffDuration: 2 }, aiName: '어둠의 빙결', aiDesc: '어둠의 냉기가 적의 영혼까지 얼려버린다.', aiVfxKeywords: ['검은 얼음', '어둠 결정'], aiQuote: '영원히 멈춰라.' },

      // ITEM_SOUL_TOME 획득
      { id: 'SK_SOUL_REAP', type: 'attack', category: 'single', cost: 3, element: 'dark', tags: ['dark', 'soul', 'drain'], effectJson: { damageMultiplier: 1.2, lifesteal: 0.3 }, aiName: '영혼 추수', aiDesc: '적의 생명력을 빼앗아 자신을 채운다.', aiVfxKeywords: ['영혼 흡수', '보라 빛'], aiQuote: '네 것이 내 것이 된다.' },

      // ITEM_THUNDER_SCROLL 획득
      { id: 'SK_LIGHTNING_BOLT', type: 'attack', category: 'single', cost: 5, element: 'thunder', tags: ['strike', 'lightning', 'thunder'], effectJson: { damageMultiplier: 1.8, debuff: 'stun', debuffDuration: 2 }, aiName: '뇌전 벼락', aiDesc: '하늘을 가르는 번개가 직격으로 떨어진다.', aiVfxKeywords: ['벼락', '눈부신 섬광'], aiQuote: '하늘이 대답한다.' },

      // ITEM_HYMN_STONE 획득
      { id: 'SK_HEALING_HYMN', type: 'resource', category: 'sync', cost: 3, element: 'light', tags: ['heal', 'light', 'holy'], effectJson: { selfHealAmount: 15, stbRestore: 2 }, aiName: '치유의 성가', aiDesc: '빛의 노래가 상처를 치유하고 마음을 안정시킨다.', aiVfxKeywords: ['온화한 빛', '치유 파동'], aiQuote: '괜찮아질 거야.' },

      // ITEM_VENOM_FANG 획득
      { id: 'SK_VENOM_SLASH', type: 'attack', category: 'single', cost: 2, element: 'poison', tags: ['slash', 'poison', 'venom'], effectJson: { damageMultiplier: 1.0, debuff: 'poison', debuffDuration: 4 }, aiName: '맹독 베기', aiDesc: '독이 스민 칼날이 오래 타오르는 상처를 남긴다.', aiVfxKeywords: ['독록 잔상', '독기'], aiQuote: '천천히… 아파라.' },

      // ITEM_BERSERKER_HEART 획득
      { id: 'SK_BERSERK_CHARGE', type: 'risk', category: 'overdrive', cost: 3, element: 'neutral', tags: ['charge', 'berserker', 'risk'], effectJson: { damageMultiplier: 2.0 }, riskJson: { stbChange: -3 }, aiName: '광폭 돌격', aiDesc: '모든 것을 걸고 돌진한다. 안정이 크게 무너진다.', aiVfxKeywords: ['붉은 기운', '폭발 충격'], aiQuote: '상관없어!!' },

      // ITEM_BLADE_SHARD 획득
      { id: 'SK_MULTI_STRIKE', type: 'attack', category: 'chain', cost: 4, element: 'neutral', tags: ['combo', 'chain', 'multi'], effectJson: { damageMultiplier: 0.5, multiHit: 3 }, aiName: '삼연격', aiDesc: '세 번의 빠른 연격이 연속으로 이어진다.', aiVfxKeywords: ['3연 섬광', '잔상 3개'], aiQuote: '하나, 둘, 셋.' },

      // ITEM_GUARDIAN_CORE 획득
      { id: 'SK_COUNTER_STANCE', type: 'defense', category: 'shield', cost: 2, element: 'neutral', tags: ['guard', 'counter', 'steel'], effectJson: { shieldAmount: 25, syncRestore: 2 }, aiName: '반격 자세', aiDesc: '견고하게 자세를 잡아 방벽을 치고 동조력을 모은다.', aiVfxKeywords: ['강철 방어막', '집중 빛'], aiQuote: '받아치겠다.' },
    ],
  });

  // ─── 특성 템플릿 20개 (MVP 핵심) ────────────────────────────────────────────

  await prisma.traitTemplate.createMany({
    skipDuplicates: true,
    data: [
      // 속성 특성 (9종 × 1 = 9개)
      { id: 'FIRE_POINT', category: 'attribute', element: 'fire', effectJson: { fireBonus: 2 }, aiName: '타오르는 예기', aiDesc: '칼끝이 불꽃처럼 뜨겁게 달아올랐다.' },
      { id: 'WATER_POINT', category: 'attribute', element: 'water', effectJson: { waterBonus: 2 }, aiName: '물결 흔적', aiDesc: '물처럼 유연한 움직임이 칼에 스며들었다.' },
      { id: 'ICE_POINT', category: 'attribute', element: 'ice', effectJson: { iceBonus: 2 }, softcapAt: 10, aiName: '서늘한 예기', aiDesc: '칼끝이 얼음처럼 차가워졌다. 작은 흔적이지만 오래 남는다.' },
      { id: 'THUNDER_POINT', category: 'attribute', element: 'thunder', effectJson: { thunderBonus: 2 }, aiName: '번개 잔흔', aiDesc: '번개의 잔향이 칼날에 새겨졌다.' },
      { id: 'WIND_POINT', category: 'attribute', element: 'wind', effectJson: { windBonus: 2 }, aiName: '바람의 여운', aiDesc: '바람처럼 날렵한 기억이 남아있다.' },
      { id: 'POISON_POINT', category: 'attribute', element: 'poison', effectJson: { poisonBonus: 2 }, aiName: '독의 흔적', aiDesc: '독기가 칼날에 스며들어 사라지지 않는다.' },
      { id: 'LIGHT_POINT', category: 'attribute', element: 'light', effectJson: { lightBonus: 2 }, aiName: '빛의 각인', aiDesc: '신성한 빛의 기억이 칼끝에 각인되었다.' },
      { id: 'DARK_POINT', category: 'attribute', element: 'dark', effectJson: { darkBonus: 2 }, aiName: '어둠의 낙인', aiDesc: '어둠이 칼날에 스며들어 지워지지 않는다.' },
      { id: 'NEUTRAL_POINT', category: 'attribute', element: 'neutral', effectJson: { atkBonus: 1 }, aiName: '순수한 예리함', aiDesc: '속성 없이 순수하게 예리해졌다.' },

      // 전투 특성 (7개)
      { id: 'CRIT_POINT', category: 'combat', effectJson: { critBonus: 1 }, aiName: '급소의 기억', aiDesc: '급소를 찌르는 법을 잊지 않았다.' },
      { id: 'SHIELD_POINT', category: 'combat', effectJson: { shieldBonus: 2 }, aiName: '방어의 각인', aiDesc: '막아낸 기억이 칼에 새겨졌다.' },
      { id: 'CHAIN_POINT', category: 'combat', effectJson: { chainBonus: 1 }, aiName: '연쇄의 리듬', aiDesc: '연속 공격의 리듬이 손에 배었다.' },
      { id: 'SYNC_START_POINT', category: 'combat', effectJson: { syncStartBonus: 1 }, aiName: '초기 동조', aiDesc: '처음부터 강하게 연결되는 법을 알았다.' },
      { id: 'STB_BOOST_POINT', category: 'combat', effectJson: { stbBonus: 1 }, aiName: '안정의 기억', aiDesc: '흔들리지 않는 법을 기억한다.' },
      { id: 'ATK_POINT', category: 'combat', effectJson: { atkBonus: 1 }, aiName: '힘의 각인', aiDesc: '강해지는 법이 칼에 새겨졌다.' },
      { id: 'DEF_POINT', category: 'combat', effectJson: { defBonus: 1 }, aiName: '수호의 기억', aiDesc: '지키는 법이 칼끝에 남아있다.' },

      // 탐험 특성 (6개)
      { id: 'DETECT_POINT', category: 'explore', effectJson: { detectBonus: 2 }, aiName: '탐지의 눈', aiDesc: '그는 끝내 함정을 먼저 보았다.' },
      { id: 'TREASURE_POINT', category: 'explore', effectJson: { treasureBonus: 2 }, aiName: '탐욕의 향', aiDesc: '보물 냄새를 맡는 법을 기억한다.' },
      { id: 'BOLD_EXPLORE_POINT', category: 'explore', effectJson: { boldBonus: 1 }, aiName: '대담한 발걸음', aiDesc: '두려움 없이 나아가는 법을 익혔다.' },

      // 지배 특성 (2개)
      { id: 'DOM_START', category: 'domination', element: 'dark', effectJson: { domStart: 1 }, domOnly: true, spawnWeight: 5, aiName: '지배의 씨앗', aiDesc: '너는 그를 움직였다.' },
      { id: 'FORCE_DISCOUNT', category: 'domination', element: 'dark', effectJson: { forceDiscount: 1 }, domOnly: true, spawnWeight: 4, aiName: '강제의 기술', aiDesc: '의지를 강요하는 비용이 줄었다.' },
    ],
  });

  // ─── 아이템 템플릿 15개 (MVP 핵심) ──────────────────────────────────────────

  await prisma.itemTemplate.createMany({
    skipDuplicates: true,
    data: [
      // 전투계
      { id: 'ITEM_IRON_SHARD', tags: ['combat', 'metal'], effectJson: { atkBonus: 3 }, rarity: 'common', shopPrice: 8, aiName: '철 파편', aiDesc: '거친 철 조각이 검에 달라붙었다.' },
      { id: 'ITEM_GUARD_STONE', tags: ['combat', 'stone'], effectJson: { defBonus: 3 }, rarity: 'common', shopPrice: 8, aiName: '수호석', aiDesc: '단단한 돌이 방어력을 높인다.' },
      { id: 'ITEM_SWIFT_FEATHER', tags: ['combat', 'wind'], effectJson: { spdBonus: 3 }, rarity: 'common', shopPrice: 8, aiName: '신속의 깃털', aiDesc: '가벼운 깃털이 속도를 높인다.' },
      { id: 'ITEM_SYNC_CRYSTAL', tags: ['sync', 'crystal'], effectJson: { syncMaxBonus: 2 }, rarity: 'common', shopPrice: 10, aiName: '동조 결정', aiDesc: '결정이 동조 한계를 넓힌다.' },
      { id: 'ITEM_CALM_STONE', tags: ['stability', 'stone'], effectJson: { stbBonus: 2 }, rarity: 'common', shopPrice: 10, aiName: '평온석', aiDesc: '돌이 검을 안정시킨다.' },

      // 속성계
      { id: 'ITEM_FROST_SHARD', tags: ['ice', 'cold'], effectJson: { atkBonus: 2, elementChange: 'ice' }, rarity: 'rare', shopPrice: 15, aiName: '서리 파편', aiDesc: '얼음 조각이 검의 속성을 바꾼다.' },
      { id: 'ITEM_EMBER_STONE', tags: ['fire', 'heat'], effectJson: { atkBonus: 2, elementChange: 'fire' }, rarity: 'rare', shopPrice: 15, aiName: '불씨 돌', aiDesc: '불꽃이 깃든 돌.' },
      { id: 'ITEM_THUNDER_CORE', tags: ['thunder', 'lightning'], effectJson: { atkBonus: 3, elementChange: 'thunder' }, rarity: 'rare', shopPrice: 18, aiName: '번개 핵', aiDesc: '번개 에너지가 응축된 핵.' },
      { id: 'ITEM_SHADOW_CRYSTAL', tags: ['dark', 'shadow'], effectJson: { atkBonus: 2, elementChange: 'dark' }, rarity: 'rare', shopPrice: 15, aiName: '그림자 결정', aiDesc: '어둠이 결정화된 파편.' },

      // 저주계 (강력 + DOM 증가)
      { id: 'ITEM_CURSED_BLADE', tags: ['curse', 'dark', 'risk'], effectJson: { atkBonus: 6, domChange: 1 }, rarity: 'rare', shopPrice: 12, aiName: '저주받은 칼날', aiDesc: '강력하지만… 무언가 변하고 있다.' },
      { id: 'ITEM_SOUL_FRAGMENT', tags: ['soul', 'dark', 'curse'], effectJson: { atkBonus: 4, stbBonus: -2, domChange: 2 }, rarity: 'epic', shopPrice: 5, aiName: '영혼 파편', aiDesc: '영혼이 깃들었다. 안정이 무너진다.' },
      { id: 'ITEM_DEMON_EYE', tags: ['demon', 'dark', 'curse'], effectJson: { atkBonus: 8, domChange: 2, stbBonus: -3 }, rarity: 'epic', shopPrice: 3, aiName: '마안', aiDesc: '보는 것만으로도 검이 달라진다.' },

      // 회복계
      { id: 'ITEM_SYNC_POTION', tags: ['restore', 'sync'], effectJson: { syncMaxBonus: 3 }, rarity: 'common', shopPrice: 12, aiName: '동조 포션', aiDesc: '동조력을 영구히 높인다.' },
      { id: 'ITEM_STABILITY_CHARM', tags: ['restore', 'stability'], effectJson: { stbBonus: 3 }, rarity: 'common', shopPrice: 12, aiName: '안정 부적', aiDesc: '흔들림을 잠재우는 부적.' },
      { id: 'ITEM_PURIFY_STONE', tags: ['purify', 'light'], effectJson: { stbBonus: 2, domChange: -1 }, rarity: 'rare', shopPrice: 20, aiName: '정화석', aiDesc: '어둠을 씻어내는 빛의 돌.' },

      // ─── 스킬 부여 아이템 7개 ────────────────────────────────────────────────

      { id: 'ITEM_SOUL_TOME', tags: ['soul', 'dark'], effectJson: { atkBonus: 2, domChange: 1, addSkillId: 'SK_SOUL_REAP' }, rarity: 'epic', shopPrice: 20, aiName: '영혼 서적', aiDesc: '금지된 지식이 담긴 고서. 영혼 추수를 가르쳐준다.' },
      { id: 'ITEM_THUNDER_SCROLL', tags: ['thunder', 'lightning'], effectJson: { addSkillId: 'SK_LIGHTNING_BOLT' }, rarity: 'rare', shopPrice: 18, aiName: '뇌전 두루마리', aiDesc: '번개를 소환하는 고대 주문서.' },
      { id: 'ITEM_HYMN_STONE', tags: ['light', 'holy'], effectJson: { stbBonus: 1, addSkillId: 'SK_HEALING_HYMN' }, rarity: 'rare', shopPrice: 18, aiName: '성가석', aiDesc: '치유의 노래가 새겨진 성스러운 돌.' },
      { id: 'ITEM_VENOM_FANG', tags: ['poison', 'venom'], effectJson: { atkBonus: 1, addSkillId: 'SK_VENOM_SLASH' }, rarity: 'rare', shopPrice: 15, aiName: '독사 어금니', aiDesc: '뱀의 독이 스민 날카로운 이빨 조각.' },
      { id: 'ITEM_BERSERKER_HEART', tags: ['berserker', 'combat'], effectJson: { stbBonus: -2, domChange: 1, addSkillId: 'SK_BERSERK_CHARGE' }, rarity: 'epic', shopPrice: 10, aiName: '광전사의 심장', aiDesc: '미친 전사의 심장. 광폭화 돌격을 각인한다.' },
      { id: 'ITEM_BLADE_SHARD', tags: ['combat', 'sharp'], effectJson: { atkBonus: 1, addSkillId: 'SK_MULTI_STRIKE' }, rarity: 'rare', shopPrice: 16, aiName: '다검 파편', aiDesc: '여러 칼날의 파편이 합쳐진 것. 삼연격을 가르쳐준다.' },
      { id: 'ITEM_GUARDIAN_CORE', tags: ['guard', 'stone'], effectJson: { defBonus: 2, addSkillId: 'SK_COUNTER_STANCE' }, rarity: 'rare', shopPrice: 16, aiName: '수호자의 핵', aiDesc: '수호자의 의지가 담긴 핵. 반격 자세를 전수한다.' },

      // ─── 태그 누적용 신규 아이템 5개 ─────────────────────────────────────────

      { id: 'ITEM_THUNDER_RING', tags: ['thunder', 'lightning'], effectJson: { atkBonus: 3, spdBonus: 1 }, rarity: 'rare', shopPrice: 14, aiName: '뇌전 반지', aiDesc: '번개가 새겨진 고리. 속도와 힘이 올라간다.' },
      { id: 'ITEM_LIGHT_CRYSTAL', tags: ['light', 'holy'], effectJson: { syncMaxBonus: 1, stbBonus: 1 }, rarity: 'common', shopPrice: 12, aiName: '빛의 결정', aiDesc: '신성한 빛이 응결된 결정.' },
      { id: 'ITEM_POISON_VIAL', tags: ['poison', 'venom'], effectJson: { atkBonus: 2, spdBonus: 2 }, rarity: 'common', shopPrice: 10, aiName: '독 바이알', aiDesc: '정제된 독이 담긴 작은 병.' },
      { id: 'ITEM_SOUL_SHARD', tags: ['soul', 'dark'], effectJson: { atkBonus: 3, stbBonus: -1 }, rarity: 'rare', shopPrice: 8, aiName: '영혼 조각', aiDesc: '부서진 영혼의 파편. 힘을 주지만 불안정하다.' },
      { id: 'ITEM_BERSERKER_SCAR', tags: ['berserker', 'combat'], effectJson: { atkBonus: 5, defBonus: -2 }, rarity: 'rare', shopPrice: 12, aiName: '광전사의 흉터', aiDesc: '수없는 전투에서 남은 흉터. 공격이 극대화된다.' },
    ],
  });

  // ─── 적 템플릿 17개 ──────────────────────────────────────────────────────────

  await prisma.enemyTemplate.createMany({
    skipDuplicates: true,
    data: [
      // 일반 적 1층 (4종)
      { id: 'ENEMY_GOBLIN', name: '고블린', category: 'normal', element: 'neutral', hp: 40, atk: 8, def: 3, spd: 7, patternJson: [{ condition: 'always', action: 'attack', priority: 1 }], statusEffects: [], floorMin: 1, floorMax: 2 },
      { id: 'ENEMY_WOLF', name: '야생 늑대', category: 'normal', element: 'wind', hp: 50, atk: 10, def: 2, spd: 12, patternJson: [{ condition: 'always', action: 'attack', priority: 1, multiplier: 1.1 }, { condition: 'hp_below_50', action: 'heavy_attack', priority: 2 }], statusEffects: [], floorMin: 1, floorMax: 2 },
      { id: 'ENEMY_SLIME_FIRE', name: '화염 슬라임', category: 'normal', element: 'fire', hp: 35, atk: 7, def: 5, spd: 4, patternJson: [{ condition: 'always', action: 'attack', priority: 1 }, { condition: 'hp_below_50', action: 'debuff', priority: 2, statusEffect: 'burn' }], statusEffects: ['burn'], floorMin: 1, floorMax: 3 },
      { id: 'ENEMY_SKELETON', name: '해골 병사', category: 'normal', element: 'dark', hp: 45, atk: 9, def: 6, spd: 6, patternJson: [{ condition: 'always', action: 'attack', priority: 1 }, { condition: 'hp_below_25', action: 'defend', priority: 2 }], statusEffects: [], floorMin: 1, floorMax: 3 },

      // 일반 적 2층 (4종)
      { id: 'ENEMY_ORC', name: '오크 전사', category: 'normal', element: 'neutral', hp: 70, atk: 14, def: 8, spd: 6, patternJson: [{ condition: 'always', action: 'attack', priority: 1 }, { condition: 'hp_below_50', action: 'heavy_attack', priority: 2 }], statusEffects: [], floorMin: 2, floorMax: 3 },
      { id: 'ENEMY_WITCH', name: '독 마녀', category: 'normal', element: 'poison', hp: 55, atk: 12, def: 4, spd: 9, patternJson: [{ condition: 'always', action: 'debuff', priority: 1, statusEffect: 'poison' }, { condition: 'hp_below_50', action: 'attack', priority: 2 }], statusEffects: ['poison'], floorMin: 2, floorMax: 3 },
      { id: 'ENEMY_ICE_GOLEM', name: '얼음 골렘', category: 'normal', element: 'ice', hp: 80, atk: 10, def: 15, spd: 3, patternJson: [{ condition: 'always', action: 'attack', priority: 1 }, { condition: 'hp_below_25', action: 'debuff', priority: 2, statusEffect: 'slow' }], statusEffects: [], floorMin: 2, floorMax: 3 },
      { id: 'ENEMY_SHADOW_BAT', name: '그림자 박쥐', category: 'normal', element: 'dark', hp: 45, atk: 13, def: 3, spd: 15, patternJson: [{ condition: 'always', action: 'attack', priority: 1 }, { condition: 'hp_below_50', action: 'debuff', priority: 2, statusEffect: 'blind' }], statusEffects: [], floorMin: 2, floorMax: 3 },

      // 일반 적 3층 (4종)
      { id: 'ENEMY_DARK_KNIGHT', name: '흑기사', category: 'normal', element: 'dark', hp: 90, atk: 16, def: 12, spd: 8, patternJson: [{ condition: 'always', action: 'attack', priority: 1 }, { condition: 'hp_below_50', action: 'heavy_attack', priority: 2, multiplier: 1.5 }], statusEffects: [], floorMin: 3, floorMax: 3 },
      { id: 'ENEMY_THUNDER_MAGE', name: '뇌전 마도사', category: 'normal', element: 'thunder', hp: 70, atk: 18, def: 5, spd: 11, patternJson: [{ condition: 'always', action: 'attack', priority: 1 }, { condition: 'hp_below_50', action: 'debuff', priority: 2, statusEffect: 'stun' }], statusEffects: [], floorMin: 3, floorMax: 3 },
      { id: 'ENEMY_FLAME_DRAKE', name: '화염 드레이크', category: 'normal', element: 'fire', hp: 85, atk: 15, def: 8, spd: 9, patternJson: [{ condition: 'always', action: 'attack', priority: 1 }, { condition: 'hp_below_25', action: 'heavy_attack', priority: 2, multiplier: 2.0 }], statusEffects: ['burn'], floorMin: 3, floorMax: 3 },
      { id: 'ENEMY_CORRUPTED_SOUL', name: '부패한 영혼', category: 'normal', element: 'dark', hp: 60, atk: 20, def: 3, spd: 13, patternJson: [{ condition: 'always', action: 'attack', priority: 1, multiplier: 1.2 }], statusEffects: [], floorMin: 3, floorMax: 3 },

      // 엘리트 (3종)
      { id: 'ELITE_BERSERKER_OROG', name: '광전사 오로그', category: 'elite', element: 'fire', hp: 120, atk: 20, def: 8, spd: 10, patternJson: [{ condition: 'always', action: 'attack', priority: 1, multiplier: 1.2 }, { condition: 'hp_below_50', action: 'heavy_attack', priority: 3, multiplier: 1.8 }], statusEffects: [], floorMin: 1, floorMax: 3 },
      { id: 'ELITE_PHANTOM_THIEF', name: '환영 도적', category: 'elite', element: 'dark', hp: 90, atk: 18, def: 5, spd: 18, patternJson: [{ condition: 'always', action: 'attack', priority: 1 }, { condition: 'hp_below_50', action: 'debuff', priority: 2, statusEffect: 'blind' }], statusEffects: [], floorMin: 2, floorMax: 3 },
      { id: 'ELITE_FROST_WITCH', name: '서리 마녀', category: 'elite', element: 'ice', hp: 100, atk: 16, def: 6, spd: 12, patternJson: [{ condition: 'always', action: 'debuff', priority: 1, statusEffect: 'slow' }, { condition: 'hp_below_50', action: 'attack', priority: 2, multiplier: 1.5 }], statusEffects: ['slow'], floorMin: 2, floorMax: 3 },

      // 보스 (3종)
      { id: 'BOSS_IRON_GUARDIAN', name: '철의 수호자', category: 'boss', element: 'neutral', hp: 140, atk: 14, def: 12, spd: 6, patternJson: [{ condition: 'always', action: 'attack', priority: 1 }, { condition: 'hp_below_50', action: 'heavy_attack', priority: 2, multiplier: 1.6 }, { condition: 'hp_below_25', action: 'defend', priority: 3 }], statusEffects: [], floorMin: 1, floorMax: 1 },
      { id: 'BOSS_WANDERING_SOUL', name: '방랑하는 영혼', category: 'boss', element: 'dark', hp: 200, atk: 18, def: 10, spd: 10, patternJson: [{ condition: 'always', action: 'attack', priority: 1 }, { condition: 'hp_below_50', action: 'heavy_attack', priority: 2, multiplier: 1.8 }, { condition: 'hp_below_25', action: 'debuff', priority: 3, statusEffect: 'stun' }], statusEffects: [], floorMin: 2, floorMax: 2 },
      { id: 'BOSS_CHAIN_BREAKER', name: '체인브레이커', category: 'boss', element: 'neutral', hp: 300, atk: 22, def: 15, spd: 8, patternJson: [{ condition: 'always', action: 'attack', priority: 1, multiplier: 1.1 }, { condition: 'hp_below_50', action: 'heavy_attack', priority: 2, multiplier: 2.0 }, { condition: 'hp_below_25', action: 'debuff', priority: 3, statusEffect: 'seal' }], statusEffects: [], floorMin: 3, floorMax: 3 },
    ],
  });

  console.log('✅ Seed complete!');
  console.log(`  - SkillTemplates: 30`);
  console.log(`  - TraitTemplates: 21`);
  console.log(`  - ItemTemplates: 27`);
  console.log(`  - EnemyTemplates: 18`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
