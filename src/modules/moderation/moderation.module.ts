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
        baseURL: configService.get<string>('AI_MODERATION_BASE_URL', 'http://localhost:8000'),
        timeout: configService.get<number>('AI_MODERATION_TIMEOUT_MS', 5000),
      }),
    }),
  ],
  controllers: [ModerationController],
  providers: [ModerationProvider, ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
