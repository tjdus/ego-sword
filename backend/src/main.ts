import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 전역 예외 필터 등록
  const { AllExceptionsFilter } = await import('./filters/all-exceptions.filter.js');
  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableCors({
    origin: ['http://localhost:3000'],
    credentials: true,
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`🗡 Ego Sword API running on port ${port}`);
}
bootstrap();
