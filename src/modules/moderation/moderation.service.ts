import { AxiosError } from 'axios';
import { Injectable, Logger } from '@nestjs/common';
import {
  defaultModerationFallback,
  moderationLabelToStatus,
  moderationStatusToVisibility,
} from './moderation.constants';
import {
  ModerationResult,
  PersistedModerationStatus,
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
        text: normalized,
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
        text: normalized,
      };
    }
  }

  toVisibilityLevel(status: PersistedModerationStatus): VisibilityLevel {
    return moderationStatusToVisibility[status];
  }

  private normalizeResult(result: ModerationResult): ModerationResult {
    const finalLabel =
      result.final_label === 'clean' ||
      result.final_label === 'offensive' ||
      result.final_label === 'hate' ||
      result.final_label === 'discrimination' ||
      result.final_label === 'supportive' ||
      result.final_label === 'other'
        ? result.final_label
        : 'clean';
    const action =
      result.action === 'ALLOW' ||
      result.action === 'WARN_USER' ||
      result.action === 'BLOCK_OR_REVIEW'
        ? result.action
        : 'WARN_USER';
    const status =
      result.status === 'APPROVED' ||
      result.status === 'WARNING' ||
      result.status === 'FLAGGED' ||
      result.status === 'AI_UNAVAILABLE'
        ? result.status
        : moderationLabelToStatus[finalLabel];

    return {
      text: result.text ?? '',
      final_label: finalLabel,
      final_confidence: Number.isFinite(result.final_confidence) ? result.final_confidence : 0,
      is_warning: Boolean(result.is_warning),
      action,
      layers: Array.isArray(result.layers)
        ? result.layers.map((layer) => ({
            layer: layer.layer,
            task: layer.task ?? 'unknown',
            model: layer.model ?? 'unknown',
            input_text: layer.input_text,
            pred_id: layer.pred_id,
            label: layer.label,
            confidence: Number.isFinite(layer.confidence) ? layer.confidence : 0,
            probabilities: layer.probabilities ?? {},
            is_warning: Boolean(layer.is_warning),
          }))
        : [],
      status,
      model:
        result.model ||
        (Array.isArray(result.layers)
          ? result.layers
              .map((layer) => layer.model)
              .filter((model): model is string => typeof model === 'string' && model.length > 0)
              .join(',')
          : '') ||
        'fallback',
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
