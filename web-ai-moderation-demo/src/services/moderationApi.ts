import { ModerationResult } from '../types/moderation';

const BACKEND_URL = 'http://localhost:3000';
export const USE_MOCK_API = false;

const BAD_WORDS_LIGHT = ['ngu', 'dan', 'cut', 'vcl', 'vl'];
const BAD_WORDS_STRONG = ['song cho', 'bac ky', 'nam ky', 'moi'];

interface BackendResponse {
  success: boolean;
  data?: {
    label: 'SAFE' | 'WARNING' | 'RESTRICTED';
    toxicityScore: number;
    categories: string[];
    message: string;
    highlights: Array<{
      text: string;
      type: string;
      start: number;
      end: number;
    }>;
    suggestion: string;
    model: string;
    visibilityLevel?: 'NORMAL' | 'LIMITED' | 'BLURRED' | 'COLLAPSED';
    shouldBlurContent?: boolean;
    moderationDisplayText?: string;
  };
}

const fallbackSafe = (backendUnavailable = false): ModerationResult => ({
  label: 'SAFE',
  toxicityScore: 0,
  categories: [],
  message: backendUnavailable
    ? 'Khong the kiem tra AI luc nay'
    : 'Noi dung an toan.',
  highlights: [],
  suggestion: '',
  model: backendUnavailable ? 'fallback' : 'mask_partial_char',
  visibilityLevel: 'NORMAL',
  shouldBlurContent: false,
  moderationDisplayText: 'Noi dung co tu ngu gay kho chiu.',
  backendUnavailable,
});

function mapResult(raw: BackendResponse['data']): ModerationResult {
  if (!raw) return fallbackSafe(true);
  const visibility =
    raw.visibilityLevel ??
    (raw.label === 'SAFE'
      ? 'NORMAL'
      : raw.label === 'WARNING'
        ? 'LIMITED'
        : 'COLLAPSED');
  return {
    label: raw.label,
    toxicityScore: raw.toxicityScore,
    categories: raw.categories ?? [],
    message: raw.message ?? '',
    highlights: raw.highlights ?? [],
    suggestion: raw.suggestion ?? '',
    model: raw.model ?? 'mask_partial_char',
    visibilityLevel: visibility,
    shouldBlurContent: raw.shouldBlurContent ?? raw.label !== 'SAFE',
    moderationDisplayText:
      raw.moderationDisplayText ?? 'Noi dung co tu ngu gay kho chiu.',
  };
}

function normalizeForMock(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mockModeration(text: string): ModerationResult {
  const normalized = normalizeForMock(text);
  const hasStrong = BAD_WORDS_STRONG.some((word) => normalized.includes(word));
  const hasLight = BAD_WORDS_LIGHT.some((word) => normalized.includes(word));

  if (!hasStrong && !hasLight) return fallbackSafe(false);

  if (hasStrong) {
    return {
      label: 'RESTRICTED',
      toxicityScore: 0.95,
      categories: ['regional_hate', 'insult'],
      message: 'Noi dung co yeu to xuc pham vung mien.',
      highlights: [],
      suggestion: 'Minh khong dong tinh voi cach hanh xu do.',
      model: 'mock-mask_partial_char',
      visibilityLevel: 'COLLAPSED',
      shouldBlurContent: true,
      moderationDisplayText: 'Noi dung co tu ngu gay kho chiu.',
    };
  }

  return {
    label: 'WARNING',
    toxicityScore: 0.72,
    categories: ['insult'],
    message: 'Noi dung co xu huong gay kho chiu.',
    highlights: [],
    suggestion: 'Hay thu dien dat nhe nhang hon.',
    model: 'mock-mask_partial_char',
    visibilityLevel: 'LIMITED',
    shouldBlurContent: true,
    moderationDisplayText: 'Noi dung co tu ngu gay kho chiu.',
  };
}

export async function checkModeration(text: string): Promise<ModerationResult> {
  const trimmed = text.trim();
  if (!trimmed) return fallbackSafe(false);

  if (USE_MOCK_API) {
    return mockModeration(trimmed);
  }

  try {
    const response = await fetch(`${BACKEND_URL}/moderation/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmed }),
    });

    if (!response.ok) {
      return fallbackSafe(true);
    }

    const payload = (await response.json()) as BackendResponse;
    return mapResult(payload.data);
  } catch (_error) {
    return fallbackSafe(true);
  }
}

export const MODERATION_API_BASE_URL = BACKEND_URL;
