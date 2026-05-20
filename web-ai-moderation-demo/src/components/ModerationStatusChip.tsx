import { ModerationLabel } from '../types/moderation';

interface Props {
  label: ModerationLabel;
}

export function ModerationStatusChip({ label }: Props): JSX.Element {
  return <span className={`chip chip-${label.toLowerCase()}`}>{label}</span>;
}
