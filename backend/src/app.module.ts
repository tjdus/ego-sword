import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { AiModule } from './modules/ai/ai.module';
import { RunModule } from './modules/run/run.module';
import { CodexModule } from './modules/codex/codex.module';
import { EngineModule } from './engine/engine.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EngineModule,
    AuthModule,
    AiModule,
    RunModule,
    CodexModule,
  ],
})
export class AppModule {}
