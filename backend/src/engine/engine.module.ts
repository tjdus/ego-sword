import { Module } from '@nestjs/common';
import { ElementEngine } from './element.engine';
import { CompatibilityEngine } from './compatibility.engine';
import { OverdriveEngine } from './overdrive.engine';
import { MagicSwordEngine } from './magic-sword.engine';
import { CombatEngine } from './combat.engine';
import { RewardEngine } from './reward.engine';
import { TriggerEngine } from './trigger.engine';

@Module({
  providers: [
    ElementEngine,
    CompatibilityEngine,
    OverdriveEngine,
    MagicSwordEngine,
    CombatEngine,
    RewardEngine,
    TriggerEngine,
  ],
  exports: [
    ElementEngine,
    CompatibilityEngine,
    OverdriveEngine,
    MagicSwordEngine,
    CombatEngine,
    RewardEngine,
    TriggerEngine,
  ],
})
export class EngineModule {}
