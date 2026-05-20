interface Props {
  score: number;
}

export function ToxicityMeter({ score }: Props): JSX.Element {
  const pct = Math.max(0, Math.min(100, Math.round(score * 100)));
  return (
    <div className="meter-wrap">
      <div className="meter-label">
        <span>Toxicity</span>
        <span>{pct}%</span>
      </div>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
