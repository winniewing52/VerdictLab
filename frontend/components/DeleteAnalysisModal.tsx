"use client";
import { useEffect, useState } from "react";
type Props = {
    open: boolean;
    title?: string;
    busy?: boolean;
    onCancel: () => void;
    onConfirm: () => void;
};
const CONFIRM_WORD = "DELETE";
export default function DeleteAnalysisModal({ open, title, busy = false, onCancel, onConfirm }: Props) {
    const [typed, setTyped] = useState("");
    const [understood, setUnderstood] = useState(false);
    useEffect(() => {
        if (!open) {
            setTyped("");
            setUnderstood(false);
        }
    }, [open]);
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !busy)
                onCancel();
        };
        document.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [open, busy, onCancel]);
    if (!open)
        return null;
    const canDelete = understood && typed.trim().toUpperCase() === CONFIRM_WORD && !busy;
    return (<div className="logout-modal-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy)
        onCancel(); }}>
      <div className="logout-modal-card delete-modal-card" role="alertdialog" aria-modal="true" aria-labelledby="delete-modal-title" aria-describedby="delete-modal-desc">
        <div className="logout-modal-icon delete-modal-icon" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <path d="M12 9v4"/>
            <path d="M12 17h.01"/>
          </svg>
        </div>
        <h2 className="logout-modal-title" id="delete-modal-title">Delete this analysis?</h2>
        <p className="logout-modal-desc" id="delete-modal-desc">
          {title ? <><b>{title}</b> will be permanently deleted. </> : "This analysis will be permanently deleted. "}
          This cannot be undone.
        </p>

        <div className="delete-warning">
          <p>If you delete it:</p>
          <ul>
            <li>All scored comments, sentiment and emotion results, and the generated report are erased.</li>
            <li>Pulse, Timeline, Emotions, Compare and Explorer will no longer show this data.</li>
            <li>It disappears from your saved analyses, and exports made from it can&apos;t be re-created.</li>
            <li>To analyse the data again you will need to re-upload your original file.</li>
          </ul>
        </div>

        <label className="logout-modal-checkbox">
          <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} disabled={busy}/>
          <span className="logout-modal-checkbox-box" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          </span>
          I understand this is permanent
        </label>

        <label className="delete-type-label" htmlFor="delete-confirm-input">Type <b>{CONFIRM_WORD}</b> to confirm</label>
        <input id="delete-confirm-input" className="delete-type-input" type="text" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={CONFIRM_WORD} autoComplete="off" spellCheck={false} disabled={busy}/>

        <div className="logout-modal-actions">
          <button type="button" className="logout-modal-cancel" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="logout-modal-confirm" onClick={onConfirm} disabled={!canDelete}>{busy ? "Deleting…" : "Delete permanently"}</button>
        </div>
      </div>
    </div>);
}
