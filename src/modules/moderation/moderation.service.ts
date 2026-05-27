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
import {
  ImagePrediction,
  MappedMediaCategory,
  MediaKind,
  MediaModerationLabel,
  MediaModerationProviderResult,
  MediaModerationResult,
  ModerateMediaRequest,
  ModerationDecision,
  VideoFramePrediction,
} from './interfaces/media-moderation.interface';

export const CONFIDENCE_THRESHOLD = 0.7;
export const VIDEO_BLOCK_FRAME_RATIO = 0.1;
export const VIDEO_BLOOD_BLUR_RATIO = 0.2;

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

  async moderateMedia(payload: ModerateMediaRequest): Promise<MediaModerationResult> {
    try {
      const providerResult = await this.moderationProvider.moderateMedia(payload);
      const decision =
        payload.mediaKind === 'image'
          ? this.moderateContent({
              mediaType: 'image',
              predictions: this.normalizePredictions('image', providerResult) as ImagePrediction,
            })
          : this.moderateContent({
              mediaType: 'video',
              predictions: this.normalizePredictions('video', providerResult) as VideoFramePrediction[],
            });

      return {
        mediaKind: payload.mediaKind,
        decision,
        model:
          providerResult.model && providerResult.model.trim().length > 0
            ? providerResult.model
            : 'unknown',
        raw: providerResult.raw ?? providerResult,
      };
    } catch (error) {
      this.logger.error(`AI media moderation request failed. ${this.formatError(error)}`);
      const fallbackDecision =
        payload.mediaKind === 'image'
          ? this.moderateContent({
              mediaType: 'image',
              predictions: { label: 'unknown', confidence: 0 },
            })
          : this.moderateContent({
              mediaType: 'video',
              predictions: [{ frame: 0, label: 'unknown', confidence: 0 }],
            });
      return {
        mediaKind: payload.mediaKind,
        decision: fallbackDecision,
        model: 'fallback',
        raw: null,
      };
    }
  }

  moderateContent(input: {
    mediaType: 'image';
    predictions: ImagePrediction;
  }): ModerationDecision;
  moderateContent(input: {
    mediaType: 'video';
    predictions: VideoFramePrediction[];
  }): ModerationDecision;
  moderateContent(input: {
    mediaType: MediaKind;
    predictions: ImagePrediction | VideoFramePrediction[];
  }): ModerationDecision {
    if (input.mediaType === 'image') {
      return this.moderateImage(input.predictions as ImagePrediction);
    }

    return this.moderateVideo(input.predictions as VideoFramePrediction[]);
  }

  toVisibilityLevel(status: PersistedModerationStatus): VisibilityLevel {
    return moderationStatusToVisibility[status];
  }

  private moderateImage(prediction: ImagePrediction): ModerationDecision {
    const label = this.normalizeMediaLabel(prediction.label);
    const confidence = this.clamp(prediction.confidence);
    const mappedCategory = this.mapCategory(label);
    const isSensitive = confidence >= CONFIDENCE_THRESHOLD;

    if (!isSensitive) {
      return this.buildDecision({
        label,
        mappedCategory,
        confidence,
        mediaType: 'image',
        action: 'allow',
        canOpen: true,
        shouldBlur: false,
        reason: 'Confidence below threshold. Allowed with logging.',
      });
    }

    if (label === 'porn' || label === 'hentai') {
      return this.buildDecision({
        label,
        mappedCategory,
        confidence,
        mediaType: 'image',
        action: 'blur_no_open',
        canOpen: false,
        shouldBlur: true,
        reason: 'Explicit image is permanently blurred.',
      });
    }

    return this.buildDecision({
      label,
      mappedCategory,
      confidence,
      mediaType: 'image',
      action: 'allow',
      canOpen: true,
      shouldBlur: false,
      reason: 'Allowed image category.',
    });
  }

  private moderateVideo(predictions: VideoFramePrediction[]): ModerationDecision {
    const frames = predictions.length > 0 ? predictions : [{ frame: 0, label: 'unknown', confidence: 0 }];
    const normalizedFrames = frames.map((item) => ({
      frame: item.frame,
      label: this.normalizeMediaLabel(item.label),
      confidence: this.clamp(item.confidence),
      sensitive: this.clamp(item.confidence) >= CONFIDENCE_THRESHOLD,
    }));
    const totalFrames = normalizedFrames.length;
    const explicitFrames = normalizedFrames.filter(
      (item) => item.sensitive && (item.label === 'porn' || item.label === 'hentai'),
    );
    const bloodFrames = normalizedFrames.filter((item) => item.sensitive && item.label === 'blood');

    const explicitRatio = explicitFrames.length / totalFrames;
    const bloodRatio = bloodFrames.length / totalFrames;

    const highest = normalizedFrames.reduce((acc, current) =>
      current.confidence > acc.confidence ? current : acc,
    );
    const mappedCategory = this.mapCategory(highest.label);

    if (explicitFrames.length >= 1 || explicitRatio >= VIDEO_BLOCK_FRAME_RATIO) {
      return this.buildDecision({
        label: highest.label === 'unknown' ? 'porn' : highest.label,
        mappedCategory:
          highest.label === 'hentai' ? 'explicit_anime' : 'sexual_explicit',
        confidence: highest.confidence,
        mediaType: 'video',
        action: 'block',
        canOpen: false,
        shouldBlur: true,
        reason: 'Video contains explicit frames and is blocked.',
      });
    }

    if (bloodRatio >= VIDEO_BLOOD_BLUR_RATIO) {
      return this.buildDecision({
        label: 'blood',
        mappedCategory: 'blood_gore',
        confidence: this.maxConfidence(bloodFrames),
        mediaType: 'video',
        action: 'blur_allow_open',
        canOpen: true,
        shouldBlur: true,
        reason: 'Video contains blood/gore frames above allowed ratio.',
      });
    }

    return this.buildDecision({
      label: highest.label,
      mappedCategory,
      confidence: highest.confidence,
      mediaType: 'video',
      action: 'allow',
      canOpen: true,
      shouldBlur: false,
      reason:
        highest.confidence < CONFIDENCE_THRESHOLD
          ? 'Confidence below threshold. Allowed with logging.'
          : 'Allowed video category.',
    });
  }

  private buildDecision(input: {
    label: MediaModerationLabel;
    mappedCategory: MappedMediaCategory;
    confidence: number;
    mediaType: MediaKind;
    action: 'allow' | 'blur_allow_open' | 'blur_no_open' | 'block';
    canOpen: boolean;
    shouldBlur: boolean;
    reason: string;
  }): ModerationDecision {
    return {
      original_label: input.label,
      mapped_category: input.mappedCategory,
      confidence: input.confidence,
      media_type: input.mediaType,
      action: input.action,
      can_open: input.canOpen,
      should_blur: input.shouldBlur,
      reason: input.reason,
    };
  }

  private normalizePredictions(
    mediaType: MediaKind,
    providerResult: MediaModerationProviderResult,
  ): ImagePrediction | VideoFramePrediction[] {
    if (mediaType === 'image') {
      if (
        providerResult.predictions &&
        !Array.isArray(providerResult.predictions) &&
        typeof providerResult.predictions.label === 'string'
      ) {
        return {
          label: providerResult.predictions.label,
          confidence: Number(providerResult.predictions.confidence ?? 0),
        };
      }

      return {
        label: providerResult.label ?? 'unknown',
        confidence: Number(providerResult.confidence ?? 0),
      };
    }

    if (Array.isArray(providerResult.predictions)) {
      return providerResult.predictions.map((entry, index) => ({
        frame: Number(entry.frame ?? index),
        label: entry.label,
        confidence: Number(entry.confidence ?? 0),
      }));
    }

    return [
      {
        frame: 0,
        label: providerResult.label ?? 'unknown',
        confidence: Number(providerResult.confidence ?? 0),
      },
    ];
  }

  private mapCategory(label: MediaModerationLabel): MappedMediaCategory {
    switch (label) {
      case 'neutral':
        return 'safe';
      case 'sexy':
        return 'suggestive';
      case 'porn':
        return 'sexual_explicit';
      case 'hentai':
        return 'explicit_anime';
      case 'blood':
        return 'blood_gore';
      case 'drawings':
        return 'drawings_artwork';
      default:
        return 'unknown';
    }
  }

  private maxConfidence(frames: Array<{ confidence: number }>): number {
    if (frames.length === 0) {
      return 0;
    }

    return frames.reduce((acc, item) => (item.confidence > acc ? item.confidence : acc), 0);
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

  private normalizeMediaLabel(label: string | undefined): MediaModerationLabel {
    switch (label) {
      case 'neutral':
      case 'sexy':
      case 'porn':
      case 'hentai':
      case 'blood':
      case 'drawings':
        return label;
      default:
        return 'unknown';
    }
  }

  private clamp(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    if (value < 0) {
      return 0;
    }

    if (value > 1) {
      return 1;
    }

    return value;
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
