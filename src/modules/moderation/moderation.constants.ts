export const AI_MODERATION_HTTP_CLIENT = 'AI_MODERATION_HTTP_CLIENT';

export const moderationStatusToVisibility = {
  SAFE: 'NORMAL',
  WARNING: 'LIMITED',
  RESTRICTED: 'COLLAPSED',
} as const;

export const defaultModerationFallback = {
  label: 'WARNING',
  toxicityScore: 0.5,
  categories: ['ai_unavailable'],
  message: 'AI moderation service is currently unavailable.',
  highlights: [],
  suggestion: 'Please review your content wording.',
  model: 'fallback',
} as const;
