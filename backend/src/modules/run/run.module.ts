import { Module } from '@nestjs/common';
import { RunService } from './run.service';
import { RunController } from './run.controller';
import { EngineModule } from '../../engine/engine.module';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [EngineModule, AiModule, AuthModule],
  providers: [RunService],
  controllers: [RunController],
})
export class RunModule {}
