"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
export type TourStep = {
    target: string;
    title: string;
    body: string;
};
export const PULSE_TOUR_STEPS: TourStep[] = [
    { target: "insight", title: "The headline", body: "Start here. One sentence summarises the biggest finding, followed by a plain-English translation." },
    { target: "metrics", title: "Key numbers", body: "Five headline figures: average mood, how many comments were scored, the top conflict, the leading emotion and the most unpredictable day." },
    { target: "trend", title: "Mood over time", body: "The line is the average mood per day. Anything below the dashed zero line is negative. Sharp dips and spikes are days worth investigating." },
    { target: "distribution", title: "Sentiment split", body: "Every comment lands in exactly one bucket: negative, neutral or positive. The three bars always add up to 100%." },
    { target: "hourglass", title: "Emotion mix", body: "Beyond good vs bad: which kind of emotion dominates. Sensitivity is fear or anger, Pleasantness is joy or sadness." },
    { target: "comments", title: "Real comments", body: "The latest scored comments in this slice, so you can check the numbers against what people actually wrote." },
];
const POP_W = 320;
const GAP = 14;
const PAD = 6;
const PHONE_MAX = 620;
type Rect = {
    top: number;
    left: number;
    width: number;
    height: number;
};
export default function PulseTour({ steps = PULSE_TOUR_STEPS, onClose }: {
    steps?: TourStep[];
    onClose: () => void;
}) {
    const [index, setIndex] = useState(0);
    const [rect, setRect] = useState<Rect | null>(null);
    const [popPos, setPopPos] = useState<{
        top: number;
        left: number;
        dock: boolean;
    } | null>(null);
    const popRef = useRef<HTMLDivElement>(null);
    const step = steps[index];
    const last = index === steps.length - 1;
    const measure = useCallback(() => {
        const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
        if (!el) {
            setRect(null);
            return;
        }
        const r = el.getBoundingClientRect();
        setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
    }, [step.target]);
    useEffect(() => {
        const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
        if (el) {
            const tall = el.getBoundingClientRect().height > window.innerHeight * 0.6;
            const phone = window.innerWidth <= PHONE_MAX;
            el.scrollIntoView({ block: tall || phone ? "start" : "center", behavior: "auto" });
        }
        measure();
        const t = window.setTimeout(measure, 120);
        return () => window.clearTimeout(t);
    }, [step.target, measure]);
    useEffect(() => {
        window.addEventListener("resize", measure);
        window.addEventListener("scroll", measure, true);
        return () => { window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
    }, [measure]);
    useLayoutEffect(() => {
        const pop = popRef.current;
        if (!pop)
            return;
        const vw = window.innerWidth, vh = window.innerHeight;
        if (vw <= PHONE_MAX) {
            setPopPos({ top: 0, left: 12, dock: true });
            return;
        }
        const w = Math.min(POP_W, vw - 24);
        const h = pop.offsetHeight;
        if (!rect) {
            setPopPos({ top: Math.max(12, (vh - h) / 2), left: Math.max(12, (vw - w) / 2), dock: false });
            return;
        }
        const left = Math.min(Math.max(12, rect.left), vw - w - 12);
        const below = rect.top + rect.height + GAP;
        const above = rect.top - GAP - h;
        let top: number;
        if (below + h <= vh - 12)
            top = below;
        else if (above >= 12)
            top = above;
        else
            top = vh - h - 16;
        setPopPos({ top, left, dock: false });
    }, [rect, index]);
    const next = useCallback(() => (last ? onClose() : setIndex((i) => i + 1)), [last, onClose]);
    const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape")
                onClose();
            else if (event.key === "ArrowRight" || event.key === "Enter")
                next();
            else if (event.key === "ArrowLeft")
                prev();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [next, prev, onClose]);
    return (<div className="tour-root" role="dialog" aria-modal="true" aria-label="Dashboard tour">
      <div className="tour-blocker" onClick={onClose}/>
      {rect ? <div className="tour-spotlight" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}/> : <div className="tour-dim"/>}
      <div ref={popRef} className="tour-popover" style={popPos?.dock
            ? { left: 12, right: 12, top: "auto", bottom: "calc(12px + env(safe-area-inset-bottom, 0px))", visibility: "visible" }
            : { top: popPos?.top ?? 0, left: popPos?.left ?? 0, width: Math.min(POP_W, typeof window === "undefined" ? POP_W : window.innerWidth - 24), visibility: popPos ? "visible" : "hidden" }}>
        <div className="tour-progress" aria-hidden="true">{steps.map((_, i) => <i key={i} className={i <= index ? "on" : ""}/>)}</div>
        <p className="tour-step">STEP {index + 1} OF {steps.length}</p>
        <h3>{step.title}</h3>
        <p className="tour-body">{step.body}</p>
        <div className="tour-actions">
          {index > 0 ? <button type="button" className="tour-skip" onClick={prev}>Back</button> : <button type="button" className="tour-skip" onClick={onClose}>Skip</button>}
          <button type="button" className="tour-next" onClick={next} autoFocus>{last ? "Done" : "Next"}</button>
        </div>
      </div>
    </div>);
}
