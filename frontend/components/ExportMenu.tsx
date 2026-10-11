"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Analysis, AnalysisResults } from "@/lib/api";
import { TONE_COLORS, buildVerdict, verdictSummaryText } from "@/lib/verdict";
import { downloadBlob, renderVerdictCard, verdictFileName } from "@/lib/verdictCard";
async function copyText(text: string) {
    try {
        await navigator.clipboard.writeText(text);
    }
    catch {
        const box = document.createElement("textarea");
        box.value = text;
        box.style.position = "fixed";
        box.style.opacity = "0";
        document.body.appendChild(box);
        box.select();
        const ok = document.execCommand("copy");
        box.remove();
        if (!ok)
            throw new Error("Couldn't copy to the clipboard.");
    }
}
function Item({ icon, title, hint, onClick, disabled }: {
    icon: string;
    title: string;
    hint: string;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (<button type="button" role="menuitem" className="export-item" onClick={onClick} disabled={disabled}>
      <span className="export-icon" aria-hidden="true">{icon}</span>
      <span>
        <b>{title}</b>
        <small>{hint}</small>
      </span>
    </button>);
}
export default function ExportMenu({ analysis, results }: {
    analysis: Analysis;
    results: AnalysisResults;
}) {
    const verdict = useMemo(() => buildVerdict(analysis, results), [analysis, results]);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [caps, setCaps] = useState({ share: false, copyImage: false });
    const rootRef = useRef<HTMLDivElement>(null);
    const noticeTimer = useRef<number | undefined>(undefined);
    const cardPromise = useRef<Promise<Blob> | null>(null);
    useEffect(() => {
        setCaps({
            share: typeof navigator.share === "function",
            copyImage: typeof ClipboardItem !== "undefined" && !!navigator.clipboard?.write,
        });
        return () => window.clearTimeout(noticeTimer.current);
    }, []);
    useEffect(() => {
        cardPromise.current = null;
    }, [verdict]);
    const getCard = useCallback((): Promise<Blob> => {
        if (!verdict)
            return Promise.reject(new Error("No verdict available yet."));
        if (!cardPromise.current) {
            const promise = renderVerdictCard(verdict);
            promise.catch(() => {
                if (cardPromise.current === promise)
                    cardPromise.current = null;
            });
            cardPromise.current = promise;
        }
        return cardPromise.current;
    }, [verdict]);
    useEffect(() => {
        if (open)
            getCard().catch(() => { });
    }, [open, getCard]);
    useEffect(() => {
        if (!open)
            return;
        const onKey = (event: KeyboardEvent) => { if (event.key === "Escape")
            setOpen(false); };
        const onDown = (event: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(event.target as Node))
                setOpen(false);
        };
        window.addEventListener("keydown", onKey);
        window.addEventListener("mousedown", onDown);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("mousedown", onDown);
        };
    }, [open]);
    if (!verdict)
        return null;
    const v = verdict;
    function flash(message: string) {
        setNotice(message);
        window.clearTimeout(noticeTimer.current);
        noticeTimer.current = window.setTimeout(() => setNotice(null), 2800);
    }
    async function run(key: string, task: () => Promise<string>) {
        if (busy)
            return;
        setBusy(key);
        try {
            flash(await task());
        }
        catch (error) {
            if (error instanceof DOMException && error.name === "AbortError")
                return;
            flash(error instanceof Error ? error.message : "Something went wrong.");
        }
        finally {
            setBusy(null);
            setOpen(false);
        }
    }
    function openReport() {
        window.open(`/workspace/report?run=${encodeURIComponent(analysis.id)}&print=1`, "_blank");
        setOpen(false);
    }
    const downloadCard = () => run("card", async () => {
        downloadBlob(await getCard(), verdictFileName(v, "png"));
        return "Verdict card saved";
    });
    const copyCard = () => run("copy-card", async () => {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": getCard() })]);
        return "Card image copied";
    });
    const shareCard = () => run("share", async () => {
        const blob = await getCard();
        const file = new File([blob], verdictFileName(v, "png"), { type: "image/png" });
        const data: ShareData = { title: `Verdict: ${v.title}`, text: verdictSummaryText(v), files: [file] };
        if (navigator.canShare?.(data))
            await navigator.share(data);
        else
            await navigator.share({ title: data.title, text: data.text });
        return "Shared";
    });
    const copySummary = () => run("copy-text", async () => {
        await copyText(verdictSummaryText(v));
        return "Summary copied";
    });
    return (<div className="export-menu" ref={rootRef}>
      <button type="button" className="export-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        ⇪ EXPORT &amp; SHARE
      </button>

      {open && (<div className="export-pop" role="menu" aria-label="Export and share">
          <div className="export-verdict">
            <i style={{ background: TONE_COLORS[v.tone] }}/>
            <span>VERDICT</span>
            <b style={{ color: TONE_COLORS[v.tone] }}>{v.word}</b>
          </div>
          <Item icon="▤" title="One-page PDF report" hint="Opens a print-ready A4 page. Choose “Save as PDF”." onClick={openReport}/>
          <Item icon="▣" title="Verdict card (PNG)" hint="1200×630 image for slides, posts and chats." onClick={downloadCard} disabled={busy !== null}/>
          {caps.share && <Item icon="↗" title="Share…" hint="Send the card and summary via your device." onClick={shareCard} disabled={busy !== null}/>}
          {caps.copyImage && <Item icon="⧉" title="Copy card image" hint="Paste it straight into Slides, Docs or a chat." onClick={copyCard} disabled={busy !== null}/>}
          <Item icon="≡" title="Copy text summary" hint="Plain text with the key numbers." onClick={copySummary} disabled={busy !== null}/>
        </div>)}

      {notice && !open && <span className="export-notice" role="status">{notice}</span>}
    </div>);
}
