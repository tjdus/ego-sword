import { Module } from '@nestjs/common';
import { ElementEngine } from './element.engine';
import { CompatibilityEngine } from './compatibility.engine';
import { OverdriveEngine } from './overdrive.engine';
import { MagicSwordEngine } from './magic-sword.engine';
import { CombatEngine } from './combat.engine';

@Module({
  providers: [
    ElementEngine,
    CompatibilityEngine,
    OverdriveEngine,
    MagicSwordEngine,
    CombatEngine,
  ],
  exports: [
    ElementEngine,
    CompatibilityEngine,
    OverdriveEngine,
    MagicSwordEngine,
    CombatEngine,
  ],
})
export class EngineModule {}
