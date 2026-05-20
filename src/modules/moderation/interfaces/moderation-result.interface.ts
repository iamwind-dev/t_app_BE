export type ModerationLabel = 'SAFE' | 'WARNING' | 'RESTRICTED';
export type VisibilityLevel = 'NORMAL' | 'LIMITED' | 'COLLAPSED';

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
}

export interface ModerateTextRequest {
  text: string;
}
