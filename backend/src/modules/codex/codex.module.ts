import { Module } from '@nestjs/common';
import { CodexController } from './codex.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CodexController],
})
export class CodexModule {}
