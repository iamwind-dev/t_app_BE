export type ModerationLabel =
  | 'clean'
  | 'offensive'
  | 'hate'
  | 'discrimination'
  | 'supportive'
  | 'other';

export type ModerationAction = 'ALLOW' | 'WARN_USER' | 'BLOCK_OR_REVIEW';
export type VisibilityLevel = 'NORMAL' | 'LIMITED' | 'COLLAPSED';

export interface ModerationHighlight {
  text: string;
  type: string;
  start: number;
  end: number;
}

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
  label: ModerationLabel;
  finalLabel: ModerationLabel;
  finalConfidence: number;
  action: ModerationAction;
  isWarning: boolean;
  categories: string[];
  message: string;
  suggestion: string;
  model: string;
  layers: ModerationLayerResult[];
  visibilityLevel: VisibilityLevel;
  shouldBlurContent: boolean;
  moderationDisplayText: string;
  backendUnavailable?: boolean;
}

export interface FeedPostItem {
  id: string;
  content: string;
  moderation: ModerationResult;
  createdAt: string;
}
