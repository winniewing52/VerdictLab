"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export default function ShareDashboard() {
    const [open, setOpen] = useState(false);
    const [url, setUrl] = useState("");
    const [feedback, setFeedback] = useState<string | null>(null);
    const qrRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open)
            return;
        const configuredOrigin = process.env.NEXT_PUBLIC_SHARE_ORIGIN?.replace(/\/$/, "");
        const browserOrigin = window.location.origin;
        const origin = configuredOrigin || (
            window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
                ? `${window.location.protocol}//${window.location.hostname}:3000`
                : browserOrigin
        );
        setUrl(`${origin}/`);
        setFeedback(null);
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape")
                setOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    async function copyUrl() {
        if (!url)
            return;
        try {
            await navigator.clipboard.writeText(url);
            setFeedback("Link copied.");
        }
        catch {
            setFeedback("Could not copy the link. Select it manually.");
        }
    }

    function downloadQr() {
        const svg = qrRef.current?.querySelector("svg");
        if (!svg)
            return;
        const source = new XMLSerializer().serializeToString(svg);
        const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = "verdictlab-dashboard-qr.svg";
        link.click();
        URL.revokeObjectURL(downloadUrl);
        setFeedback("QR code downloaded.");
    }

    return <>
      <button type="button" className="share-dashboard-button" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span aria-hidden="true">▦</span> Share dashboard
      </button>
      {open && <div className="share-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget)
              setOpen(false);
      }}>
        <section className="share-modal" role="dialog" aria-modal="true" aria-labelledby="share-dashboard-title">
          <div className="share-modal-head">
            <div>
              <p className="share-eyebrow">MOBILE ACCESS</p>
              <h2 id="share-dashboard-title">Scan to open this dashboard</h2>
            </div>
            <button type="button" className="share-close" onClick={() => setOpen(false)} aria-label="Close share dialog">×</button>
          </div>
          <div className="share-qr" ref={qrRef}>
            {url && <QRCodeSVG value={url} size={224} bgColor="#ffffff" fgColor="#080b0e" level="M" includeMargin />}
          </div>
          <p className="share-help">Scan this code with your phone camera. You may need to sign in on the new device.</p>
          <label className="share-url-label" htmlFor="dashboard-share-url">Dashboard link</label>
          <input id="dashboard-share-url" className="share-url" value={url} readOnly onFocus={(event) => event.currentTarget.select()} />
          <div className="share-actions">
            <button type="button" className="share-secondary" onClick={copyUrl}>Copy link</button>
            <button type="button" className="share-primary" onClick={downloadQr}>Download QR</button>
          </div>
          {feedback && <p className="share-feedback" role="status">{feedback}</p>}
        </section>
      </div>}
    </>;
}
