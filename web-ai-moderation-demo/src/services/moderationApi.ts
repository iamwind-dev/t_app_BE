import { ModerationLayerResult, ModerationResult } from '../types/moderation';

const BACKEND_URL = 'http://localhost:3000';
export const USE_MOCK_API = false;

interface BackendModerationLayer {
  layer: string;
  task: string;
  model: string;
  input_text: string;
  pred_id: number;
  label: ModerationLayerResult['label'];
  confidence: number;
  probabilities: Record<string, number>;
  is_warning: boolean;
}

interface BackendModerationResult {
  text: string;
  final_label: ModerationResult['finalLabel'];
  final_confidence: number;
  is_warning: boolean;
  action: ModerationResult['action'];
  layers: BackendModerationLayer[];
  model?: string;
}

interface BackendResponse {
  success: boolean;
  data?: BackendModerationResult;
}

function toVisibilityLevel(action: ModerationResult['action']): ModerationResult['visibilityLevel'] {
  if (action === 'BLOCK_OR_REVIEW') return 'COLLAPSED';
  if (action === 'WARN_USER') return 'LIMITED';
  return 'NORMAL';
}

function toDisplayMessage(label: ModerationResult['finalLabel']): string {
  if (label === 'hate') return 'Noi dung co dau hieu hate speech.';
  if (label === 'discrimination') return 'Noi dung co dau hieu phan biet vung mien.';
  if (label === 'offensive') return 'Noi dung co xu huong xuc pham.';
  if (label === 'supportive') return 'Noi dung mang tinh ung ho tich cuc.';
  return 'Noi dung an toan.';
}

function toSuggestion(label: ModerationResult['finalLabel']): string {
  if (label === 'hate' || label === 'discrimination') {
    return 'Hay viet lai theo huong ton trong va tranh ky thi/xuc pham.';
  }
  if (label === 'offensive') {
    return 'Hay dieu chinh cau tu nhe nhang hon truoc khi dang.';
  }
  return '';
}

const fallbackSafe = (backendUnavailable = false): ModerationResult => ({
  label: 'clean',
  finalLabel: 'clean',
  finalConfidence: 0,
  action: 'ALLOW',
  isWarning: false,
  categories: [],
  message: backendUnavailable ? 'Khong the kiem tra AI luc nay' : 'Noi dung an toan.',
  suggestion: '',
  model: backendUnavailable ? 'fallback' : 'demo',
  layers: [],
  visibilityLevel: 'NORMAL',
  shouldBlurContent: false,
  moderationDisplayText: 'Noi dung co the gay kho chiu cho nguoi khac.',
  backendUnavailable,
});

function mapResult(raw: BackendModerationResult | undefined): ModerationResult {
  if (!raw) return fallbackSafe(true);

  const categories = Array.from(
    new Set(raw.layers.filter((layer) => layer.is_warning).map((layer) => layer.label)),
  );
  const visibilityLevel = toVisibilityLevel(raw.action);

  return {
    label: raw.final_label,
    finalLabel: raw.final_label,
    finalConfidence: raw.final_confidence,
    action: raw.action,
    isWarning: raw.is_warning,
    categories,
    message: toDisplayMessage(raw.final_label),
    suggestion: toSuggestion(raw.final_label),
    model:
      raw.model ??
      raw.layers.map((layer) => layer.model).join(', ') ??
      'unknown',
    layers: raw.layers,
    visibilityLevel,
    shouldBlurContent: raw.action === 'BLOCK_OR_REVIEW',
    moderationDisplayText:
      raw.final_label === 'discrimination'
        ? 'Noi dung co dau hieu phan biet vung mien.'
        : 'Noi dung co tu ngu gay kho chiu.',
  };
}

export async function checkModeration(text: string): Promise<ModerationResult> {
  const trimmed = text.trim();
  if (!trimmed) return fallbackSafe(false);

  if (USE_MOCK_API) {
    return fallbackSafe(false);
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
