interface Props {
  suggestion: string;
  onApply: () => void;
}

export function RewriteSuggestion({ suggestion, onApply }: Props): JSX.Element | null {
  if (!suggestion) return null;

  return (
    <div className="suggestion-card">
      <p className="suggestion-label">Goi y dien dat</p>
      <p>{suggestion}</p>
      <button type="button" className="ghost-btn" onClick={onApply}>
        Dung goi y
      </button>
    </div>
  );
}
