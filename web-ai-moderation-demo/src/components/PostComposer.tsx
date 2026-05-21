import { useEffect, useState } from 'react';
import { checkModeration } from '../services/moderationApi';
import { ModerationResult } from '../types/moderation';
import { HighlightedText } from './HighlightedText';
import { ModerationStatusChip } from './ModerationStatusChip';
import { RewriteSuggestion } from './RewriteSuggestion';
import { ToxicityMeter } from './ToxicityMeter';

interface Props {
  onSubmit: (content: string, moderation: ModerationResult) => void;
  onNeedConfirm: (content: string, moderation: ModerationResult) => void;
}

const emptyModeration: ModerationResult = {
  label: 'clean',
  finalLabel: 'clean',
  finalConfidence: 0,
  action: 'ALLOW',
  isWarning: false,
  categories: [],
  message: 'Nhap noi dung de bat dau kiem tra.',
  suggestion: '',
  model: 'pending',
  layers: [],
  visibilityLevel: 'NORMAL',
  shouldBlurContent: false,
  moderationDisplayText: 'Noi dung co tu ngu gay kho chiu.',
};

export function PostComposer({ onSubmit, onNeedConfirm }: Props): JSX.Element {
  const [content, setContent] = useState('');
  const [moderation, setModeration] = useState<ModerationResult>(emptyModeration);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const text = content.trim();
    if (!text) {
      setModeration(emptyModeration);
      return;
    }

    const handle = window.setTimeout(async () => {
      setChecking(true);
      const result = await checkModeration(text);
      setModeration(result);
      setChecking(false);
    }, 1000);

    return () => window.clearTimeout(handle);
  }, [content]);

  const handlePost = () => {
    const text = content.trim();
    if (!text) return;
    if (moderation.action === 'ALLOW') {
      onSubmit(text, moderation);
      setContent('');
      return;
    }
    onNeedConfirm(text, moderation);
  };

  const applySuggestion = () => {
    if (moderation.suggestion) {
      setContent(moderation.suggestion);
    }
  };

  return (
    <section className="card composer">
      <h2>Tao bai post</h2>
      <textarea
        placeholder="Ban dang nghi gi?"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        rows={5}
      />

      <div className="composer-row">
        <ModerationStatusChip label={moderation.label} />
        <span className="meta">{checking ? 'Dang kiem tra AI...' : moderation.model}</span>
      </div>

      <ToxicityMeter score={moderation.finalConfidence} />

      <div className="card sub-card">
        <p className="sub-title">Preview highlight</p>
        <HighlightedText text={content} highlights={[]} />
        <p className="meta">{moderation.message}</p>
      </div>

      <div className="card sub-card">
        <p className="sub-title">AI explanation</p>
        <p>{moderation.categories.length ? moderation.categories.join(', ') : 'safe'}</p>
        <p className="meta">Action: {moderation.action}</p>
        {moderation.backendUnavailable && (
          <p className="small-warning">Khong the kiem tra AI luc nay</p>
        )}
      </div>

      <RewriteSuggestion suggestion={moderation.suggestion} onApply={applySuggestion} />

      <button type="button" className="primary-btn" onClick={handlePost}>
        Dang
      </button>
    </section>
  );
}
