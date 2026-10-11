"use client";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
export type InfoContent = {
    title: string;
    body: ReactNode;
};
export default function InfoTip({ title, children }: {
    title: string;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const [pinned, setPinned] = useState(false);
    const [pos, setPos] = useState<{
        top: number;
        left: number;
    } | null>(null);
    const btnRef = useRef<HTMLButtonElement>(null);
    const tipRef = useRef<HTMLDivElement>(null);
    const id = useId();
    const place = useCallback(() => {
        const btn = btnRef.current;
        if (!btn)
            return;
        const r = btn.getBoundingClientRect();
        const width = Math.min(300, window.innerWidth - 24);
        const height = tipRef.current?.offsetHeight ?? 0;
        const left = Math.max(12, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 12));
        let top = r.bottom + 8;
        if (top + height > window.innerHeight - 12 && r.top - 8 - height > 12)
            top = r.top - 8 - height;
        setPos({ top, left });
    }, []);
    useLayoutEffect(() => {
        if (!open) {
            setPos(null);
            return;
        }
        place();
        window.addEventListener("scroll", place, true);
        window.addEventListener("resize", place);
        return () => { window.removeEventListener("scroll", place, true); window.removeEventListener("resize", place); };
    }, [open, place]);
    useEffect(() => {
        if (!open)
            return;
        const close = () => { setPinned(false); setOpen(false); };
        const onKey = (event: KeyboardEvent) => { if (event.key === "Escape")
            close(); };
        const onDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (btnRef.current?.contains(target) || tipRef.current?.contains(target))
                return;
            close();
        };
        window.addEventListener("keydown", onKey);
        window.addEventListener("mousedown", onDown);
        return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("mousedown", onDown); };
    }, [open]);
    return (<>
      <button ref={btnRef} type="button" className={`info-btn${open ? " is-open" : ""}`} aria-label={`About ${title}`} aria-expanded={open} aria-describedby={open ? id : undefined} onMouseEnter={() => setOpen(true)} onMouseLeave={() => { if (!pinned)
        setOpen(false); }} onFocus={() => setOpen(true)} onBlur={() => { if (!pinned)
        setOpen(false); }} onClick={(event) => { event.stopPropagation(); const next = !pinned; setPinned(next); setOpen(next || open); }}>i</button>
      {open && createPortal(<div ref={tipRef} id={id} role="tooltip" className="info-pop" style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? "visible" : "hidden" }}>
          <p className="info-pop-title">{title}</p>
          <p className="info-pop-body">{children}</p>
        </div>, document.body)}
    </>);
}
