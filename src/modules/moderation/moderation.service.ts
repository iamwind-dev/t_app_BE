import { AxiosError } from 'axios';
import { Injectable, Logger } from '@nestjs/common';
import {
  defaultModerationFallback,
  moderationStatusToVisibility,
} from './moderation.constants';
import {
  ModerationLabel,
  ModerationResult,
  VisibilityLevel,
} from './interfaces/moderation-result.interface';
import { ModerationProvider } from './moderation.provider';

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(private readonly moderationProvider: ModerationProvider) {}

  async moderateText(text: string): Promise<ModerationResult> {
    const normalized = text.trim();
    if (!normalized) {
      return {
        ...defaultModerationFallback,
        label: 'SAFE',
        toxicityScore: 0,
        categories: [],
        message: 'No text content.',
        highlights: [],
        suggestion: '',
        model: 'fallback',
      };
    }

    try {
      const result = await this.moderationProvider.moderateText({
        text: normalized,
      });

      return this.normalizeResult(result);
    } catch (error) {
      this.logger.error(
        `AI moderation request failed. Fallback applied. ${this.formatError(error)}`,
      );

      return {
        ...defaultModerationFallback,
        categories: [...defaultModerationFallback.categories],
        highlights: [...defaultModerationFallback.highlights],
      };
    }
  }

  toVisibilityLevel(label: ModerationLabel): VisibilityLevel {
    return moderationStatusToVisibility[label];
  }

  private normalizeResult(result: ModerationResult): ModerationResult {
    const label: ModerationLabel =
      result.label === 'SAFE' || result.label === 'WARNING' || result.label === 'RESTRICTED'
        ? result.label
        : 'WARNING';

    return {
      label,
      toxicityScore: Number.isFinite(result.toxicityScore) ? result.toxicityScore : 0.5,
      categories: Array.isArray(result.categories) ? result.categories : ['ai_unavailable'],
      message: result.message || '',
      highlights: Array.isArray(result.highlights) ? result.highlights : [],
      suggestion: result.suggestion || '',
      model: result.model || 'fallback',
    };
  }

  private formatError(error: unknown): string {
    if (error instanceof AxiosError) {
      const responseStatus = error.response?.status;
      const responseData = error.response?.data;
      const responseText =
        responseData !== undefined ? JSON.stringify(responseData) : 'no_response_body';
      return [
        `code=${error.code ?? 'UNKNOWN'}`,
        `message=${error.message}`,
        `url=${error.config?.baseURL ?? ''}${error.config?.url ?? ''}`,
        `status=${responseStatus ?? 'NO_STATUS'}`,
        `response=${responseText}`,
      ].join(' ');
    }

    if (error instanceof Error) {
      return `message=${error.message}`;
    }

    return `error=${String(error)}`;
  }
}
