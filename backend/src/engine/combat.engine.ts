import { Injectable } from '@nestjs/common';
import type {
  Element,
  OwnerClass,
  SwordStats,
  OwnerCombatStats,
  OwnerPersonalityStats,
  AppliedStatus,
  SkillEffect,
  SkillRisk,
  EnemyPattern,
  TurnResult,
  TurnLogEntry,
  SwordStateSnapshot,
  OwnerStateSnapshot,
  EnemyStateSnapshot,
} from '../shared/types/game.types';
import {
  COMPAT_HIGH_THRESHOLD,
  COMPAT_LOW_THRESHOLD,
  SYNC_RECOVERY_BASE,
  SYNC_RECOVERY_HIGH_COMPAT,
  MAGIC_SWORD_DOM_THRESHOLD,
} from '../shared/constants/game.constants';
import { ElementEngine } from './element.engine';
import { CompatibilityEngine } from './compatibility.engine';
import { OverdriveEngine } from './overdrive.engine';
import { MagicSwordEngine, MagicSwordAction, ForceActionType } from './magic-sword.engine';

// ─── 전투 컨텍스트 ────────────────────────────────────────────────────────────

export interface BattleContext {
  turnNumber: number;
  sword: SwordStats & {
    element: Element;
    activeSkillIds: string[];
    statusEffects: AppliedStatus[];
    isOverdriven: boolean;
    isMagicSword: boolean;
  };
  owner: OwnerCombatStats & {
    class: OwnerClass;
    personalityStats: OwnerPersonalityStats;
    statusEffects: AppliedStatus[];
    misjudgeChance: number; // 누적 오판 확률
  };
  enemy: {
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
  };
  compatibilityScore: number;
  ownerElement: Element;
}

export interface SkillInput {
  skillId: string;
  effect: SkillEffect;
  risk?: SkillRisk;
  element: Element;
  cost: number; // SYNC 비용
  magicSwordAction?: MagicSwordAction;
  forceActionType?: ForceActionType;
}

@Injectable()
export class CombatEngine {
  constructor(
    private readonly elementEngine: ElementEngine,
    private readonly compatEngine: CompatibilityEngine,
    private readonly overdriveEngine: OverdriveEngine,
    private readonly magicSwordEngine: MagicSwordEngine,
  ) {}

  /**
   * 1턴 실행
   * 1. 상태이상 처리
   * 2. 검 스킬 사용 (마검 행동 포함)
   * 3. 주인 AI 행동
   * 4. 적 행동
   * 5. 턴 종료 (SYNC 회복, 폭주 체크, 마검 STB 감소)
   */
  executeTurn(
    ctx: BattleContext,
    skillInput: SkillInput,
    random: () => number = Math.random,
  ): TurnResult {
    const logs: TurnLogEntry[] = [];
    // 딥 카피로 상태 변경 추적
    const sword = this.cloneSword(ctx.sword);
    const owner = this.cloneOwner(ctx.owner);
    const enemy = this.cloneEnemy(ctx.enemy);

    // ── 1. 상태이상 틱 처리 ──────────────────────────────────────────────────
    this.processStatusEffects(sword, owner, enemy, logs);

    if (enemy.hp <= 0) {
      return this.buildResult(ctx.turnNumber, logs, sword, owner, enemy, true);
    }
    if (owner.hp <= 0) {
      return this.buildResult(ctx.turnNumber, logs, sword, owner, enemy, false, true);
    }

    // ── 2. 마검 행동 (강제/재시도) ──────────────────────────────────────────
    let ownerActionOverride: string | null = null;
    if (skillInput.magicSwordAction && this.magicSwordEngine.isMagicSword(sword.dom)) {
      const { syncAfter, valid } = this.magicSwordEngine.applyAction(sword, skillInput.magicSwordAction);
      if (valid) {
        sword.sync = syncAfter;
        ownerActionOverride = skillInput.magicSwordAction === 'force'
          ? (skillInput.forceActionType ?? 'attack')
          : null; // retry: 재롤 처리
        logs.push({
          actorType: 'sword',
          actionType: 'magic_sword_action',
          text: skillInput.magicSwordAction === 'force'
            ? `내가 움직인다. (SYNC -2)`
            : `한 번 더… (SYNC -2)`,
          stateChanges: { sync: syncAfter - (sword.sync + 2) },
        });
      }
    }

    // ── 3. 검 스킬 사용 ──────────────────────────────────────────────────────
    // SYNC 비용 검증
    if (sword.sync < skillInput.cost) {
      // 비용 부족 시 기본 공격으로 대체 (서버 권위 보정)
      logs.push({ actorType: 'sword', actionType: 'basic_attack', text: 'SYNC 부족, 기본 공격 사용' });
      const basicDmg = this.calcBasicDamage(sword.atk, enemy.def, sword, ctx.compatibilityScore);
      const finalDmg = this.elementEngine.applyElementMultiplier(basicDmg, sword.element, enemy.element);
      enemy.hp = Math.max(0, enemy.hp - finalDmg);
      logs.push({ actorType: 'sword', actionType: 'basic_attack', damageDealt: finalDmg });
    } else {
      sword.sync -= skillInput.cost;
      this.applySkillEffect(skillInput, sword, owner, enemy, ctx, logs, random);
    }

    // 리스크 적용 (STB/DOM 변화)
    if (skillInput.risk) {
      if (skillInput.risk.stbChange) {
        sword.stb = Math.min(20, Math.max(1, sword.stb + skillInput.risk.stbChange));
      }
      if (skillInput.risk.domChange) {
        sword.dom = Math.min(10, Math.max(0, sword.dom + skillInput.risk.domChange));
        sword.isMagicSword = this.magicSwordEngine.isMagicSword(sword.dom);
      }
    }

    if (enemy.hp <= 0) {
      return this.buildResult(ctx.turnNumber, logs, sword, owner, enemy, true);
    }

    // ── 4. 주인 AI 행동 ──────────────────────────────────────────────────────
    this.executeOwnerAI(owner, enemy, sword, ctx, logs, random, ownerActionOverride);

    if (enemy.hp <= 0) {
      return this.buildResult(ctx.turnNumber, logs, sword, owner, enemy, true);
    }

    // ── 5. 적 행동 ───────────────────────────────────────────────────────────
    if (!enemy.statusEffects.some(s => s.type === 'stun' || s.type === 'freeze')) {
      this.executeEnemyAction(enemy, owner, sword, logs, random);
    }

    if (owner.hp <= 0) {
      return this.buildResult(ctx.turnNumber, logs, sword, owner, enemy, false, true);
    }

    // ── 6. 턴 종료 처리 ──────────────────────────────────────────────────────
    // SYNC 회복
    const syncRecovery = ctx.compatibilityScore >= COMPAT_HIGH_THRESHOLD
      ? SYNC_RECOVERY_HIGH_COMPAT
      : SYNC_RECOVERY_BASE;
    sword.sync = Math.min(sword.syncMax, sword.sync + syncRecovery);

    // 마검 STB 감소
    const { stbAfter } = this.magicSwordEngine.applyTurnEnd(sword);
    sword.stb = stbAfter;
    sword.isMagicSword = this.magicSwordEngine.isMagicSword(sword.dom);

    // 폭주 체크
    const overdriveResult = this.overdriveEngine.check(sword, owner, random);
    if (overdriveResult.triggered) {
      sword.isOverdriven = true;
      sword.sync = Math.min(sword.syncMax, sword.sync + overdriveResult.syncBonus);
      if (overdriveResult.isOwnerHpDrain) {
        owner.hp = Math.max(0, owner.hp - overdriveResult.ownerHpDrain);
      } else {
        owner.misjudgeChance = Math.min(100, owner.misjudgeChance + overdriveResult.misjudgeBonus);
      }
      logs.push({
        actorType: 'sword',
        actionType: 'overdrive',
        text: `폭주! ATK ×1.25, SYNC +1${overdriveResult.isOwnerHpDrain ? `, 주인 HP -${overdriveResult.ownerHpDrain}` : ', 오판 확률 +15%'}`,
        stateChanges: { ownerHp: -overdriveResult.ownerHpDrain },
      });
    } else {
      sword.isOverdriven = false;
    }

    // 상태이상 지속시간 감소
    this.tickStatusDurations(sword);
    this.tickStatusDurations(owner);
    this.tickStatusDurations(enemy);

    return this.buildResult(ctx.turnNumber, logs, sword, owner, enemy);
  }

  // ─── 스킬 효과 적용 ───────────────────────────────────────────────────────

  private applySkillEffect(
    skill: SkillInput,
    sword: BattleContext['sword'],
    owner: BattleContext['owner'],
    enemy: BattleContext['enemy'],
    ctx: BattleContext,
    logs: TurnLogEntry[],
    random: () => number,
  ): void {
    const effect = skill.effect;

    // 공격 피해
    if (effect.damageMultiplier) {
      let baseDmg = Math.round(sword.atk * effect.damageMultiplier);
      // 폭주 ATK 보너스
      if (sword.isOverdriven) {
        baseDmg = Math.round(baseDmg * 1.25);
      }
      // 조화 속성 보너스
      if (ctx.compatibilityScore >= COMPAT_HIGH_THRESHOLD) {
        baseDmg = Math.round(baseDmg * 1.10);
      }
      const finalDmg = this.elementEngine.applyElementMultiplier(baseDmg, skill.element, enemy.element);
      const reduced = Math.max(1, finalDmg - Math.floor(enemy.def * 0.3));
      enemy.hp = Math.max(0, enemy.hp - reduced);
      logs.push({
        actorType: 'sword',
        actionType: 'skill',
        skillId: skill.skillId,
        damageDealt: reduced,
      });
    }

    // 광역 피해
    if (effect.aoeMultiplier) {
      const aoeDmg = Math.round(sword.atk * effect.aoeMultiplier);
      const finalDmg = this.elementEngine.applyElementMultiplier(aoeDmg, skill.element, enemy.element);
      enemy.hp = Math.max(0, enemy.hp - Math.max(1, finalDmg));
      logs.push({ actorType: 'sword', actionType: 'skill_aoe', skillId: skill.skillId, damageDealt: finalDmg });
    }

    // 상태이상 부여
    if (effect.debuff && effect.debuffDuration) {
      enemy.statusEffects.push({ type: effect.debuff, duration: effect.debuffDuration });
      logs.push({ actorType: 'sword', actionType: 'debuff', statusApplied: { type: effect.debuff, duration: effect.debuffDuration } });
    }

    // SYNC 회복
    if (effect.syncRestore) {
      sword.sync = Math.min(sword.syncMax, sword.sync + effect.syncRestore);
      logs.push({ actorType: 'sword', actionType: 'sync_restore', healAmount: effect.syncRestore });
    }

    // 보호막 (DEF 임시 상승으로 처리 - MVP)
    if (effect.shieldAmount) {
      logs.push({ actorType: 'sword', actionType: 'shield', healAmount: effect.shieldAmount, text: `보호막 ${effect.shieldAmount} 획득` });
    }
  }

  // ─── 주인 AI 행동 ─────────────────────────────────────────────────────────

  private executeOwnerAI(
    owner: BattleContext['owner'],
    enemy: BattleContext['enemy'],
    sword: BattleContext['sword'],
    ctx: BattleContext,
    logs: TurnLogEntry[],
    random: () => number,
    forceAction: string | null,
  ): void {
    // 조화 낮으면 오판 확률 적용
    const misjudgeBonus = ctx.compatibilityScore <= COMPAT_LOW_THRESHOLD ? 10 : 0;
    const totalMisjudgeChance = owner.misjudgeChance + misjudgeBonus;

    if (totalMisjudgeChance > 0 && random() * 100 < totalMisjudgeChance) {
      // 오판: 엉뚱한 행동
      logs.push({ actorType: 'owner', actionType: 'misjudge', text: '…뭔가 어긋난다.' });
      return;
    }

    const action = forceAction ?? this.chooseOwnerAction(owner.class, owner, enemy, ctx.compatibilityScore, random);

    switch (action) {
      case 'attack': {
        const dmg = Math.max(1, owner.pow - Math.floor(enemy.def * 0.3));
        enemy.hp = Math.max(0, enemy.hp - dmg);
        logs.push({ actorType: 'owner', actionType: 'attack', damageDealt: dmg });
        break;
      }
      case 'defend':
        // 방어: 다음 피해 감소 (임시로 로그만)
        logs.push({ actorType: 'owner', actionType: 'defend', text: '방어 태세' });
        break;
      case 'heal': {
        const heal = Math.floor(owner.hpMax * 0.15);
        owner.hp = Math.min(owner.hpMax, owner.hp + heal);
        logs.push({ actorType: 'owner', actionType: 'heal', healAmount: heal });
        break;
      }
      default:
        logs.push({ actorType: 'owner', actionType: 'attack', text: '기본 공격' });
    }
  }

  private chooseOwnerAction(
    ownerClass: string,
    owner: BattleContext['owner'],
    enemy: BattleContext['enemy'],
    compat: number,
    random: () => number,
  ): string {
    const hpRatio = owner.hp / owner.hpMax;

    switch (ownerClass) {
      case 'warrior':
        return 'attack';
      case 'mage':
        return compat >= COMPAT_HIGH_THRESHOLD ? 'attack' : (random() < 0.7 ? 'attack' : 'defend');
      case 'paladin':
        if (hpRatio < 0.4) return 'heal';
        return hpRatio < 0.6 ? 'defend' : 'attack';
      case 'rogue':
        return random() < 0.8 ? 'attack' : 'defend';
      case 'hunter':
        return 'attack';
      case 'berserker':
        return 'attack'; // 항상 공격
      default:
        return 'attack';
    }
  }

  // ─── 적 행동 ─────────────────────────────────────────────────────────────

  private executeEnemyAction(
    enemy: BattleContext['enemy'],
    owner: BattleContext['owner'],
    sword: BattleContext['sword'],
    logs: TurnLogEntry[],
    random: () => number,
  ): void {
    const hpRatio = enemy.hp / enemy.hpMax;

    // 패턴 우선순위 정렬 후 조건 체크
    const sorted = [...enemy.patterns].sort((a, b) => b.priority - a.priority);

    for (const pattern of sorted) {
      if (this.checkEnemyCondition(pattern.condition, hpRatio, 0)) {
        this.applyEnemyAction(pattern, enemy, owner, sword, logs, random);
        return;
      }
    }

    // 폴백: 기본 공격
    const dmg = Math.max(1, enemy.atk - Math.floor(sword.def * 0.3));
    owner.hp = Math.max(0, owner.hp - dmg);
    logs.push({ actorType: 'enemy', actionType: 'attack', damageDealt: dmg });
  }

  private checkEnemyCondition(condition: string, hpRatio: number, turnNumber: number): boolean {
    switch (condition) {
      case 'always': return true;
      case 'hp_below_50': return hpRatio < 0.5;
      case 'hp_below_25': return hpRatio < 0.25;
      case 'turn_3': return turnNumber >= 3;
      default: return true;
    }
  }

  private applyEnemyAction(
    pattern: EnemyPattern,
    enemy: BattleContext['enemy'],
    owner: BattleContext['owner'],
    sword: BattleContext['sword'],
    logs: TurnLogEntry[],
    random: () => number,
  ): void {
    switch (pattern.action) {
      case 'attack': {
        const mult = pattern.multiplier ?? 1.0;
        const dmg = Math.max(1, Math.round(enemy.atk * mult) - Math.floor(sword.def * 0.3));
        owner.hp = Math.max(0, owner.hp - dmg);
        logs.push({ actorType: 'enemy', actionType: 'attack', damageDealt: dmg });
        break;
      }
      case 'heavy_attack': {
        const dmg = Math.max(1, Math.round(enemy.atk * 1.8) - Math.floor(sword.def * 0.2));
        owner.hp = Math.max(0, owner.hp - dmg);
        logs.push({ actorType: 'enemy', actionType: 'heavy_attack', damageDealt: dmg, text: '강공격!' });
        break;
      }
      case 'debuff':
        if (pattern.statusEffect) {
          owner.statusEffects.push({ type: pattern.statusEffect, duration: 2 });
          logs.push({ actorType: 'enemy', actionType: 'debuff', statusApplied: { type: pattern.statusEffect, duration: 2 } });
        }
        break;
      case 'defend':
        logs.push({ actorType: 'enemy', actionType: 'defend', text: '방어 태세' });
        break;
    }
  }

  // ─── 상태이상 처리 ────────────────────────────────────────────────────────

  private processStatusEffects(
    sword: BattleContext['sword'],
    owner: BattleContext['owner'],
    enemy: BattleContext['enemy'],
    logs: TurnLogEntry[],
  ): void {
    // 주인 상태이상 틱
    for (const status of owner.statusEffects) {
      if (status.type === 'burn' || status.type === 'poison') {
        const dmg = Math.floor(owner.hpMax * 0.05);
        owner.hp = Math.max(0, owner.hp - dmg);
        logs.push({ actorType: 'owner', actionType: 'status_tick', damageDealt: dmg, text: `${status.type} 데미지` });
      }
    }

    // 적 상태이상 틱
    for (const status of enemy.statusEffects) {
      if (status.type === 'burn' || status.type === 'poison') {
        const dmg = Math.floor(enemy.hpMax * 0.05);
        enemy.hp = Math.max(0, enemy.hp - dmg);
        logs.push({ actorType: 'enemy', actionType: 'status_tick', damageDealt: dmg });
      }
    }
  }

  private tickStatusDurations(entity: { statusEffects: AppliedStatus[] }): void {
    entity.statusEffects = entity.statusEffects
      .map(s => ({ ...s, duration: s.duration - 1 }))
      .filter(s => s.duration > 0);
  }

  // ─── 유틸 ─────────────────────────────────────────────────────────────────

  private calcBasicDamage(atk: number, enemyDef: number, sword: BattleContext['sword'], compat: number): number {
    let dmg = atk;
    if (sword.isOverdriven) dmg = Math.round(dmg * 1.25);
    if (compat >= COMPAT_HIGH_THRESHOLD) dmg = Math.round(dmg * 1.10);
    return Math.max(1, dmg - Math.floor(enemyDef * 0.3));
  }

  private cloneSword(s: BattleContext['sword']): BattleContext['sword'] {
    return { ...s, statusEffects: s.statusEffects.map(e => ({ ...e })) };
  }

  private cloneOwner(o: BattleContext['owner']): BattleContext['owner'] {
    return { ...o, statusEffects: o.statusEffects.map(e => ({ ...e })) };
  }

  private cloneEnemy(e: BattleContext['enemy']): BattleContext['enemy'] {
    return { ...e, statusEffects: e.statusEffects.map(s => ({ ...s })), patterns: e.patterns };
  }

  private buildResult(
    turnNumber: number,
    logs: TurnLogEntry[],
    sword: BattleContext['sword'],
    owner: BattleContext['owner'],
    enemy: BattleContext['enemy'],
    won?: boolean,
    ownerDied?: boolean,
  ): TurnResult {
    const swordStateAfter: SwordStateSnapshot = {
      sync: sword.sync,
      syncMax: sword.syncMax,
      stb: sword.stb,
      dom: sword.dom,
      atk: sword.atk,
      def: sword.def,
      spd: sword.spd,
      isOverdriven: sword.isOverdriven,
      isMagicSword: sword.isMagicSword,
      statusEffects: sword.statusEffects,
    };
    const ownerStateAfter: OwnerStateSnapshot = {
      hp: owner.hp,
      hpMax: owner.hpMax,
      statusEffects: owner.statusEffects,
    };
    const enemyStateAfter: EnemyStateSnapshot = {
      id: enemy.id,
      name: enemy.name,
      element: enemy.element,
      hp: enemy.hp,
      hpMax: enemy.hpMax,
      atk: enemy.atk,
      def: enemy.def,
      spd: enemy.spd,
      patterns: enemy.patterns,
      statusEffects: enemy.statusEffects,
    };

    const battleEnd = won !== undefined
      ? { won: won ?? false, ownerDied: ownerDied ?? false }
      : undefined;

    return { turnNumber, logs, swordStateAfter, ownerStateAfter, enemyStateAfter, battleEnd };
  }
}
