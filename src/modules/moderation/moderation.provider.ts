import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { ModerateTextRequest, ModerationResult } from './interfaces/moderation-result.interface';
import { ModerateMediaRequest, MediaModerationProviderResult } from './interfaces/media-moderation.interface';

@Injectable()
export class ModerationProvider {
  constructor(private readonly httpService: HttpService) {}

  async moderateText(payload: ModerateTextRequest): Promise<ModerationResult> {
    const response = await firstValueFrom(
      this.httpService.post<ModerationResult>('/moderate', {
        text: payload.text,
      }),
    );

    return response.data;
  }

  async moderateMedia(payload: ModerateMediaRequest): Promise<MediaModerationProviderResult> {
    const response = await firstValueFrom(
      this.httpService.post<MediaModerationProviderResult>('/moderate/media', payload),
    );

    return response.data;
  }
}
