// ─── 속성 ────────────────────────────────────────────────────────────────────

export type Element =
  | 'fire'
  | 'water'
  | 'ice'
  | 'thunder'
  | 'wind'
  | 'poison'
  | 'light'
  | 'dark'
  | 'neutral';

// ─── 직업 ────────────────────────────────────────────────────────────────────

export type OwnerClass =
  | 'warrior'
  | 'mage'
  | 'paladin'
  | 'rogue'
  | 'hunter'
  | 'berserker';

export type Rarity = 'common' | 'rare' | 'epic';

// ─── 방 타입 ──────────────────────────────────────────────────────────────────

export type RoomType = 'battle' | 'elite' | 'event' | 'shop' | 'rest' | 'boss';
export type RoomStatus = 'locked' | 'available' | 'completed';

// ─── 검 스탯 ─────────────────────────────────────────────────────────────────

export interface SwordStats {
  atk: number;   // 5~60, 기본 10
  def: number;   // 0~40, 기본 5
  spd: number;   // 0~30, 기본 8
  sync: number;  // 0~20 (현재), 기본 8
  syncMax: number;
  stb: number;   // 0~20, 기본 10
  dom: number;   // 0~10, 기본 0
}

// ─── 주인 스탯 ────────────────────────────────────────────────────────────────

export interface OwnerCombatStats {
  hp: number;
  hpMax: number;
  pow: number;
  guard: number;
  agi: number;
  focus: number;
}

export interface OwnerPersonalityStats {
  det: number;    // 탐지 0~10
  greed: number;  // 탐욕
  bold: number;   // 대담
  caut: number;   // 신중
  mercy: number;  // 자비
}

// ─── 상태이상 ─────────────────────────────────────────────────────────────────

export type StatusEffect =
  | 'burn'    // 화상: 매 턴 HP 감소
  | 'slow'    // 둔화: SPD 감소
  | 'stun'    // 기절: 행동 불가
  | 'blind'   // 실명: 명중 감소
  | 'poison'  // 독: 매 턴 HP 감소
  | 'freeze'  // 빙결: 행동 불가 + 해제 후 취약
  | 'seal';   // 봉인: 스킬 사용 불가

export interface AppliedStatus {
  type: StatusEffect;
  duration: number;   // 남은 턴 수
  stacks?: number;
}

// ─── 스킬 ─────────────────────────────────────────────────────────────────────

export type SkillType = 'attack' | 'defense' | 'control' | 'resource' | 'risk';
export type SkillCategory = 'single' | 'aoe' | 'chain' | 'shield' | 'debuff' | 'sync' | 'overdrive';

export interface SkillEffect {
  damageMultiplier?: number;
  shieldAmount?: number;
  healAmount?: number;
  debuff?: StatusEffect;
  debuffDuration?: number;
  syncRestore?: number;
  extraTurn?: boolean;
  aoeMultiplier?: number;
}

export interface SkillRisk {
  stbChange?: number;
  domChange?: number;
  hpCost?: number;
}

// ─── 적 패턴 ─────────────────────────────────────────────────────────────────

export type EnemyCondition = 'always' | 'hp_below_50' | 'hp_below_25' | 'turn_3';
export type EnemyAction = 'attack' | 'heavy_attack' | 'defend' | 'debuff' | 'buff' | 'heal';

export interface EnemyPattern {
  condition: EnemyCondition;
  action: EnemyAction;
  priority: number;
  multiplier?: number;
  statusEffect?: StatusEffect;
}

// ─── 조화 계산 ────────────────────────────────────────────────────────────────

export interface CompatBreakdown {
  classCompat: number;    // 0~35
  elementCompat: number;  // 0~30
  personalityCompat: number; // 0~20
  statCompat: number;     // 0~15
  domPenalty: number;     // DOM * 6
  total: number;          // clamp(0~100)
}

// ─── 특성 효과 ────────────────────────────────────────────────────────────────

export interface TraitEffect {
  // 속성 특성
  fireBonus?: number;
  waterBonus?: number;
  iceBonus?: number;
  thunderBonus?: number;
  windBonus?: number;
  poisonBonus?: number;
  lightBonus?: number;
  darkBonus?: number;
  // 전투 특성
  critBonus?: number;       // 치명타 확률 +%
  shieldBonus?: number;     // 보호막 효율 +%
  chainBonus?: number;      // 추가연계 확률 +%
  // 탐험 특성
  detectBonus?: number;     // 탐지 +%
  treasureBonus?: number;   // 보물방 +%
  // 지배 특성
  domStart?: number;        // 시작 DOM +
  forceDiscount?: number;   // 강제 비용 -
}

// ─── 아이템 효과 ──────────────────────────────────────────────────────────────

export interface ItemEffect {
  atkBonus?: number;
  defBonus?: number;
  spdBonus?: number;
  syncMaxBonus?: number;
  stbBonus?: number;
  domChange?: number;
  elementChange?: Element;
  addSkillId?: string;
  addTag?: string;
}

// ─── 턴 결과 ─────────────────────────────────────────────────────────────────

export interface TurnResult {
  turnNumber: number;
  logs: TurnLogEntry[];
  swordStateAfter: SwordStateSnapshot;
  ownerStateAfter: OwnerStateSnapshot;
  enemyStateAfter: EnemyStateSnapshot;
  battleEnd?: BattleEndResult;
}

export interface TurnLogEntry {
  actorType: 'sword' | 'owner' | 'enemy';
  actionType: string;
  skillId?: string;
  damageDealt?: number;
  healAmount?: number;
  statusApplied?: AppliedStatus;
  stateChanges?: Partial<Record<string, number>>;
  text?: string;  // 연출 텍스트
}

export interface SwordStateSnapshot {
  sync: number;
  syncMax: number;
  stb: number;
  dom: number;
  atk: number;
  def: number;
  spd: number;
  isOverdriven: boolean;
  isMagicSword: boolean;
  statusEffects: AppliedStatus[];
}

export interface OwnerStateSnapshot {
  hp: number;
  hpMax: number;
  statusEffects: AppliedStatus[];
}

export interface EnemyStateSnapshot {
  id: string;
  name: string;
  element: Element;
  hp: number;
  hpMax: number;
  atk: number;
  def: number;
  spd: number;
  patterns: EnemyPattern[];
  statusEffects: AppliedStatus[];
}

export interface BattleEndResult {
  won: boolean;
  rewards?: BattleReward[];
  ownerDied?: boolean;
}

export interface BattleReward {
  type: 'item' | 'sync' | 'trait_candidate';
  itemId?: string;
  traitId?: string;
}
