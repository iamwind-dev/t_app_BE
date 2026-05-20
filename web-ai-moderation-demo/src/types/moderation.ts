export type ModerationLabel = 'SAFE' | 'WARNING' | 'RESTRICTED';
export type VisibilityLevel = 'NORMAL' | 'LIMITED' | 'BLURRED' | 'COLLAPSED';

export interface ModerationHighlight {
  text: string;
  type: string;
  start: number;
  end: number;
}

export interface ModerationResult {
  label: ModerationLabel;
  toxicityScore: number;
  categories: string[];
  message: string;
  highlights: ModerationHighlight[];
  suggestion: string;
  model: string;
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
