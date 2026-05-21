import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ModerationController } from './moderation.controller';
import { ModerationProvider } from './moderation.provider';
import { ModerationService } from './moderation.service';

@Module({
  imports: [
    ConfigModule,
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        baseURL: configService.get<string>('AI_SERVICE_URL', 'http://localhost:8000'),
        timeout: configService.get<number>('AI_SERVICE_TIMEOUT_MS', 8000),
      }),
    }),
  ],
  controllers: [ModerationController],
  providers: [ModerationProvider, ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
