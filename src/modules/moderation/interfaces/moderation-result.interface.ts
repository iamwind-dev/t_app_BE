export type ModerationLabel =
  | 'clean'
  | 'offensive'
  | 'hate'
  | 'discrimination'
  | 'supportive'
  | 'other';
export type ModerationAction = 'ALLOW' | 'WARN_USER' | 'BLOCK_OR_REVIEW';
export type PersistedModerationStatus =
  | 'APPROVED'
  | 'WARNING'
  | 'FLAGGED'
  | 'AI_UNAVAILABLE';
export type VisibilityLevel = 'NORMAL' | 'LIMITED' | 'COLLAPSED';

export interface ModerationLayerResult {
  layer: string;
  task: string;
  model: string;
  input_text: string;
  pred_id: number;
  label: ModerationLabel;
  confidence: number;
  probabilities: Record<string, number>;
  is_warning: boolean;
}

export interface ModerationResult {
  text: string;
  final_label: ModerationLabel;
  final_confidence: number;
  is_warning: boolean;
  action: ModerationAction;
  layers: ModerationLayerResult[];
  status: PersistedModerationStatus;
  model: string;
}

export interface ModerateTextRequest {
  text: string;
}
