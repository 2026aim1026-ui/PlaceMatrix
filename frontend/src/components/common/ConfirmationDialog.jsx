import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

/**
 * Confirmation for destructive / important actions.
 * If `requireReason` is set, the confirm button stays disabled until a reason is typed; it is passed to onConfirm.
 */
export default function ConfirmationDialog({
  open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', tone = 'primary',
  requireReason = false, reasonLabel = 'Reason', reasonPlaceholder = '',
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) { setReason(''); setBusy(false); }
  }, [open]);

  const disabled = busy || (requireReason && reason.trim().length < 5);
  // onConfirm may return a promise (API call): keep the button disabled until it settles.
  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setBusy(false);
    }
  };
  const btn = tone === 'danger' ? 'btn-danger' : tone === 'success' ? 'btn-success' : 'btn-primary';
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className={`btn ${btn}`} disabled={disabled} onClick={confirm}>{busy ? 'Working…' : confirmLabel}</button>
        </>
      )}
    >
      <div className="flex gap-3">
        {tone === 'danger' && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-50 text-danger">
            <AlertTriangle className="h-4 w-4" aria-hidden />
          </span>
        )}
        <div className="flex-1 text-sm text-ink-soft">{message}</div>
      </div>
      {requireReason && (
        <div className="mt-4">
          <label htmlFor="confirm-reason" className="label">{reasonLabel} <span className="text-danger">*</span></label>
          <textarea id="confirm-reason" rows={3} className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={reasonPlaceholder} />
          {requireReason && reason.trim().length < 5 && reason.length > 0 && <p className="mt-1 text-xs text-danger">Please enter at least 5 characters.</p>}
        </div>
      )}
    </Modal>
  );
}
