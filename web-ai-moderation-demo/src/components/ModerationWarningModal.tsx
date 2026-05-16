interface Props {
  open: boolean;
  onEdit: () => void;
  onPostAnyway: () => void;
}

export function ModerationWarningModal({
  open,
  onEdit,
  onPostAnyway,
}: Props): JSX.Element | null {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <h3>Noi dung co the gay kho chiu</h3>
        <p>
          Noi dung nay co the gay kho chiu cho nguoi khac. Ban co muon xem lai truoc khi dang?
        </p>
        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={onEdit}>
            Chinh sua
          </button>
          <button type="button" className="danger-btn" onClick={onPostAnyway}>
            Van dang
          </button>
        </div>
      </div>
    </div>
  );
}
