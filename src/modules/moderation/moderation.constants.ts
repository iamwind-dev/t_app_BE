import {
  ModerationLabel,
  ModerationResult,
  PersistedModerationStatus,
  VisibilityLevel,
} from './interfaces/moderation-result.interface';

export const moderationLabelToStatus: Record<
  ModerationLabel,
  Exclude<PersistedModerationStatus, 'AI_UNAVAILABLE'>
> = {
  clean: 'APPROVED',
  offensive: 'WARNING',
  discrimination: 'FLAGGED',
  hate: 'FLAGGED',
  supportive: 'APPROVED',
  other: 'APPROVED',
};

export const moderationStatusToVisibility: Record<PersistedModerationStatus, VisibilityLevel> = {
  APPROVED: 'NORMAL',
  WARNING: 'LIMITED',
  FLAGGED: 'COLLAPSED',
  AI_UNAVAILABLE: 'NORMAL',
};

export const defaultModerationFallback: ModerationResult = {
  text: '',
  final_label: 'clean',
  final_confidence: 0,
  is_warning: false,
  action: 'ALLOW',
  layers: [],
  status: 'AI_UNAVAILABLE',
  model: 'fallback',
};
