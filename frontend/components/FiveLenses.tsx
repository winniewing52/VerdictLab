"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
type Lens = {
    num: string;
    title: string;
    desc: string;
    tab: "Pulse" | "Timeline" | "Emotions" | "Compare" | "Explore";
    preview: (on: boolean) => ReactNode;
};
function PulsePreview({ on }: {
    on: boolean;
}) {
    const parts = [
        { label: "POS", pct: 52, cls: "bg-[#4bc28a]" },
        { label: "NEU", pct: 31, cls: "bg-muted/60" },
        { label: "NEG", pct: 17, cls: "bg-alert" },
    ];
    return (<div>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-line">
        {parts.map((p) => (<div key={p.label} className={`${p.cls} h-full transition-all duration-1000 ease-out`} style={{ width: on ? `${p.pct}%` : "0%" }}/>))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-muted">
        {parts.map((p) => (<span key={p.label}>
            {p.label} {p.pct}%
          </span>))}
      </div>
    </div>);
}
function TimelinePreview({ on }: {
    on: boolean;
}) {
    const pts = [18, 14, 9, 11, 6, 15, 22, 17, 10, 12, 7, 4];
    const w = 240;
    const h = 40;
    const step = w / (pts.length - 1);
    const d = pts.map((y, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${y + 6}`).join(" ");
    return (<svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full" preserveAspectRatio="none" aria-hidden>
      <line x1="0" x2={w} y1="20" y2="20" stroke="#232326" strokeDasharray="3 3"/>
      <path d={d} fill="none" stroke="#F2CB2E" strokeWidth="1.6" vectorEffect="non-scaling-stroke" pathLength={1} strokeDasharray={1} strokeDashoffset={on ? 0 : 1} style={{ transition: "stroke-dashoffset 1.4s ease-out" }}/>
      <circle cx={6 * step} cy={22 + 6 - 6} r="2.5" fill="#E24C3E" opacity={on ? 1 : 0} style={{ transition: "opacity .4s 1.2s" }}/>
    </svg>);
}
function EmotionsPreview({ on }: {
    on: boolean;
}) {
    const bars = [
        { n: "Joy", v: 24, c: "#5bbf8a" },
        { n: "Exc", v: 19, c: "#f2b73a" },
        { n: "Cur", v: 15, c: "#7d9fb7" },
        { n: "Dbt", v: 14, c: "#cf6e43" },
        { n: "Frs", v: 11, c: "#e0524a" },
        { n: "Ang", v: 6, c: "#b83a3a" },
    ];
    return (<div className="flex h-10 items-end gap-2">
      {bars.map((b) => (<div key={b.n} className="flex flex-1 flex-col items-center gap-1">
          <div className="w-full rounded-[2px] transition-all duration-1000 ease-out" style={{ height: on ? `${(b.v / 24) * 28}px` : "2px", background: b.c }}/>
          <span className="font-mono text-[9px] text-muted">{b.n}</span>
        </div>))}
    </div>);
}
function ComparePreview({ on }: {
    on: boolean;
}) {
    const rows = [
        { n: "REDDIT", v: 38, c: "bg-signal" },
        { n: "YOUTUBE", v: 61, c: "bg-[#7d9fb7]" },
    ];
    return (<div className="space-y-2">
      {rows.map((r) => (<div key={r.n} className="flex items-center gap-3">
          <span className="w-14 font-mono text-[10px] text-muted">{r.n}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
            <div className={`${r.c} h-full rounded-full transition-all duration-1000 ease-out`} style={{ width: on ? `${r.v}%` : "0%" }}/>
          </div>
          <span className="w-8 text-right font-mono text-[10px] text-muted">+{r.v}</span>
        </div>))}
    </div>);
}
function ExplorePreview({ on }: {
    on: boolean;
}) {
    const rows = [
        { t: "Neck strain after an hour…", s: "r/VisionPro", c: "bg-alert" },
        { t: "Passthrough is pure magic…", s: "YouTube", c: "bg-[#4bc28a]" },
    ];
    return (<div className="space-y-1.5">
      {rows.map((r, i) => (<div key={r.s} className="flex items-center gap-2 rounded-sm border border-line bg-ink/60 px-2 py-1.5 transition-all duration-700" style={{ opacity: on ? 1 : 0, transform: on ? "none" : "translateY(6px)", transitionDelay: `${i * 150}ms` }}>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${r.c}`}/>
          <span className="truncate text-[11px] text-muted">{r.t}</span>
          <span className="ml-auto shrink-0 font-mono text-[9px] text-muted/70">{r.s}</span>
        </div>))}
    </div>);
}
const LENSES: Lens[] = [
    {
        num: "01",
        title: "Pulse",
        desc: "A first read on overall sentiment and where the conversation is currently leaning.",
        tab: "Pulse",
        preview: (on) => <PulsePreview on={on}/>,
    },
    {
        num: "02",
        title: "Timeline",
        desc: "Watch how sentiment and mood shift across days, posts, and moments.",
        tab: "Timeline",
        preview: (on) => <TimelinePreview on={on}/>,
    },
    {
        num: "03",
        title: "Emotions",
        desc: "Look beyond positive and negative to see the emotions shaping a discussion.",
        tab: "Emotions",
        preview: (on) => <EmotionsPreview on={on}/>,
    },
    {
        num: "04",
        title: "Compare",
        desc: "Set communities or periods side by side to surface what changed.",
        tab: "Compare",
        preview: (on) => <ComparePreview on={on}/>,
    },
    {
        num: "05",
        title: "Explore",
        desc: "Drill into the source records behind a finding.",
        tab: "Explore",
        preview: (on) => <ExplorePreview on={on}/>,
    },
];
const EVIDENCE_POINTS = [
    "Every score links back to the original post or comment",
    "VADER, TextBlob and SenticNet 7 are shown side by side",
    "Disagreements between models are flagged, not hidden",
];
export default function FiveLenses() {
    const ref = useRef<HTMLElement>(null);
    const [on, setOn] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el)
            return;
        if (typeof IntersectionObserver === "undefined") {
            setOn(true);
            return;
        }
        const io = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setOn(true);
                io.disconnect();
            }
        }, { threshold: 0.15 });
        io.observe(el);
        return () => io.disconnect();
    }, []);
    return (<section ref={ref} id="lenses" className="relative border-b border-line scroll-mt-4">
      <div className="max-w-7xl mx-auto px-5 py-14 sm:px-10 sm:py-20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.17em] text-signal">
              What you get
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl tracking-tight text-[#EDEDEF]">
              Five lenses, one evidence base
            </h2>
          </div>
          <p className="font-mono text-[11px] sm:text-xs uppercase tracking-[0.12em] text-muted">
            Explainable · SenticNet 7
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LENSES.map((lens, i) => (<Link key={lens.num} href={`/demo?tab=${lens.tab}`} className="group flex flex-col rounded-lg border border-line bg-panel p-6 sm:p-7 transition duration-300 hover:-translate-y-1 hover:border-signal/60 hover:bg-[#151518] focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal" style={{
                opacity: on ? 1 : 0,
                transform: on ? undefined : "translateY(14px)",
                transitionProperty: "opacity, transform, border-color, background-color",
                transitionDelay: on ? `${i * 90}ms` : "0ms",
            }}>
              <span className="font-mono text-xs text-signal">{lens.num}</span>
              <h3 className="mt-5 font-serif text-2xl text-[#EDEDEF]">{lens.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">{lens.desc}</p>

              <div className="mt-5 min-h-[44px]">{lens.preview(on)}</div>

              <span className="mt-6 inline-flex items-center gap-2 font-mono text-sm text-signal">
                View sample
                <span className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                  ↗
                </span>
              </span>
            </Link>))}

          <div className="flex flex-col rounded-lg border border-signal/30 bg-signal/[0.04] p-6 sm:p-7 transition-all duration-300 hover:border-signal/60" style={{
            opacity: on ? 1 : 0,
            transform: on ? undefined : "translateY(14px)",
            transitionDelay: on ? `${LENSES.length * 90}ms` : "0ms",
        }}>
            <span className="font-mono text-xs uppercase tracking-wide text-signal">Grounded</span>
            <h3 className="mt-5 font-serif text-2xl text-[#EDEDEF]">Evidence &amp; explainability</h3>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              Trace the reading to source records instead of relying on a score alone.
            </p>

            <ul className="mt-5 space-y-2">
              {EVIDENCE_POINTS.map((point) => (<li key={point} className="flex gap-2 text-[13px] leading-snug text-muted">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-signal"/>
                  {point}
                </li>))}
            </ul>

            <Link href="/demo?tab=Explore" className="mt-6 inline-flex items-center gap-2 font-mono text-sm text-signal hover:brightness-110">
              See the evidence trail <span>↗</span>
            </Link>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-5 rounded-lg border border-line bg-panel/40 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div>
            <p className="font-serif text-xl text-[#EDEDEF]">See all five lenses on real data.</p>
            <p className="mt-1 text-sm text-muted">
              Try the pre-loaded  case study, or paste your own Reddit or YouTube link.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/demo" className="flex items-center gap-2 border border-line px-5 py-3 rounded-sm text-sm font-medium hover:border-muted transition">
              ▷ Watch the demo
            </Link>
            <Link href="/workspace/access" className="bg-signal text-ink font-medium px-5 py-3 rounded-sm text-sm hover:brightness-95 transition">
              Start a new analysis →
            </Link>
          </div>
        </div>
      </div>
    </section>);
}
