import { z } from "zod";

// StatusEffect zod enum
const STATUS_EFFECTS = [
  'burn',    // 화상: 매 턴 HP 감소
  'slow',    // 둔화: SPD 감소
  'stun',    // 기절: 행동 불가
  'blind',   // 실명: 명중 감소
  'poison',  // 독: 매 턴 HP 감소
  'freeze',  // 빙결: 행동 불가 + 해제 후 취약
  'seal',    // 봉인: 스킬 사용 불가
] as const;

export const StatusEffectSchema = z.enum(STATUS_EFFECTS);

export const AppliedStatusSchema = z.object({
  type: StatusEffectSchema,
  duration: z.number(),
  stacks: z.number().optional(),
});

export const AppliedStatusArraySchema = z.array(AppliedStatusSchema);

// EnemyCondition zod enum
const ENEMY_CONDITIONS = [
  'always',
  'hp_below_50',
  'hp_below_25',
  'turn_3',
] as const;

// EnemyAction zod enum
const ENEMY_ACTIONS = [
  'attack',
  'heavy_attack',
  'defend',
  'debuff',
  'buff',
  'heal',
] as const;

export const EnemyPatternSchema = z.object({
  condition: z.enum(ENEMY_CONDITIONS),
  action: z.enum(ENEMY_ACTIONS),
  priority: z.number().int().min(0),
  multiplier: z.number().min(0).optional(),
  statusEffect: StatusEffectSchema.optional(),
});

export const EnemyPatternArraySchema = z.array(EnemyPatternSchema);

