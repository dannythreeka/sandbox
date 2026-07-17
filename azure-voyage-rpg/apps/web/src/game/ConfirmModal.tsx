'use client';

interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ message, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div className="confirm-modal-backdrop" role="dialog" aria-modal="true">
      <div className="confirm-modal-card">
        <p className="confirm-modal-message">{message}</p>
        <div className="confirm-modal-actions">
          <button className="btn-ghost" onClick={onCancel}>取消</button>
          <button className="btn btn-danger" onClick={onConfirm} autoFocus>確定</button>
        </div>
      </div>
    </div>
  );
}
