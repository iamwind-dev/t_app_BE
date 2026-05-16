import { useState } from 'react';

interface Props {
  content: string;
  warningText: string;
}

export function BlurredContent({ content, warningText }: Props): JSX.Element {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="blurred-block">
      <div className="blurred-content-wrap">
        <p className={`real-content ${revealed ? '' : 'is-blurred'}`}>{content}</p>
        {!revealed && <div className="blur-overlay" aria-hidden="true" />}
      </div>
      <p className="blur-warning">
        <em>{warningText}</em>
      </p>
      <button
        type="button"
        className="link-btn"
        onClick={() => setRevealed((prev) => !prev)}
      >
        {revealed ? 'An lai' : 'Hien noi dung'}
      </button>
    </div>
  );
}
