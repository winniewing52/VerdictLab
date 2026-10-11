"use client";
import { useEffect, useState } from "react";
type LogoutModalProps = {
    open: boolean;
    appName?: string;
    busy?: boolean;
    onCancel: () => void;
    onConfirm: (allDevices: boolean) => void;
};
export default function LogoutModal({ open, appName = "VerdictLab", busy = false, onCancel, onConfirm, }: LogoutModalProps) {
    const [allDevices, setAllDevices] = useState(false);
    useEffect(() => {
        if (!open)
            setAllDevices(false);
    }, [open]);
    useEffect(() => {
        if (!open)
            return;
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape" && !busy)
                onCancel();
        }
        document.addEventListener("keydown", onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [open, busy, onCancel]);
    if (!open)
        return null;
    return (<div className="logout-modal-overlay" role="presentation" onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy)
                onCancel();
        }}>
      <div className="logout-modal-card" role="alertdialog" aria-modal="true" aria-labelledby="logout-modal-title" aria-describedby="logout-modal-desc">
        <div className="logout-modal-icon" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <path d="M16 17l5-5-5-5"/>
            <path d="M21 12H9"/>
          </svg>
        </div>

        <h2 id="logout-modal-title" className="logout-modal-title">
          Log out of {appName}?
        </h2>
        <p id="logout-modal-desc" className="logout-modal-desc">
          You&apos;ll need to sign in again to view your analyses. Any run still in
          progress keeps processing in the background.
        </p>

        <label className="logout-modal-checkbox">
          <input type="checkbox" checked={allDevices} disabled={busy} onChange={(e) => setAllDevices(e.target.checked)}/>
          <span className="logout-modal-checkbox-box" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7"/>
            </svg>
          </span>
          <span>Also sign out on all other devices</span>
        </label>

        <div className="logout-modal-actions">
          <button type="button" className="logout-modal-cancel" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="logout-modal-confirm" onClick={() => onConfirm(allDevices)} disabled={busy}>
            {busy ? "Signing out…" : "Log out"}
          </button>
        </div>
      </div>
    </div>);
}
