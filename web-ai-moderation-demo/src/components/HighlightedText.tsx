import { ModerationHighlight } from '../types/moderation';

interface Props {
  text: string;
  highlights: ModerationHighlight[];
}

export function HighlightedText({ text, highlights }: Props): JSX.Element {
  if (!text || highlights.length === 0) {
    return <p className="preview-text">{text || 'Khong co noi dung.'}</p>;
  }

  const ordered = [...highlights]
    .filter((h) => h.start >= 0 && h.end > h.start)
    .sort((a, b) => a.start - b.start);

  const nodes: JSX.Element[] = [];
  let cursor = 0;
  ordered.forEach((item, idx) => {
    if (cursor < item.start) {
      nodes.push(
        <span key={`normal-${idx}-${cursor}`}>{text.slice(cursor, item.start)}</span>,
      );
    }
    nodes.push(
      <mark key={`mark-${idx}`} title={item.type}>
        {text.slice(item.start, item.end)}
      </mark>,
    );
    cursor = item.end;
  });

  if (cursor < text.length) {
    nodes.push(<span key="tail">{text.slice(cursor)}</span>);
  }

  return <p className="preview-text">{nodes}</p>;
}
