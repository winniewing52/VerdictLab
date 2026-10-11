"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AccountError, getAnalysis, getResults, type Analysis, type AnalysisResults } from "@/lib/api";
import { useActiveRun } from "@/lib/useActiveRun";
import NoAnalysisSelected from "@/components/NoAnalysisSelected";
import { DIMENSION_COLORS, DIMENSION_KEYS, DIMENSION_LABELS, type ScoredRecord } from "@/lib/analysisData";
import { TONE_COLORS_PAPER, buildVerdict, downsample, signed, type Verdict } from "@/lib/verdict";
import { downloadBlob, renderVerdictCard, verdictFileName } from "@/lib/verdictCard";
const SENTIMENT_COLORS = { negative: "#e0483f", neutral: "#0b93b3", positive: "#2fa36f" };
const CONFIDENCE_COLORS = { High: "#3fbf85", Medium: "#f0ae2a", Low: "#ef4e50" };
function Kpi({ label, value, detail, valueClass }: {
    label: string;
    value: string;
    detail: string;
    valueClass?: string;
}) {
    const size = value.length > 12 ? 16 : value.length > 9 ? 19 : undefined;
    return (<div className="rp-kpi">
      <span>{label}</span>
      <strong className={valueClass} style={size ? { fontSize: size } : undefined}>{value}</strong>
      <small>{detail}</small>
    </div>);
}
function TrendChart({ points, color }: {
    points: Verdict["trend"];
    color: string;
}) {
    const pts = downsample(points, 80);
    if (pts.length < 2)
        return <p className="rp-empty">Not enough dated records to chart a trend.</p>;
    const values = pts.map((p) => p.polarity);
    const lo = Math.min(0, ...values);
    const hi = Math.max(0, ...values);
    const pad = (hi - lo || 1) * 0.15;
    const min = lo - pad;
    const max = hi + pad;
    const W = 360;
    const H = 126;
    const L = 34;
    const R = 6;
    const T = 8;
    const B = 18;
    const x = (i: number) => L + (i / (pts.length - 1)) * (W - L - R);
    const y = (value: number) => T + (1 - (value - min) / (max - min)) * (H - T - B);
    const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.polarity).toFixed(1)}`).join(" ");
    const area = `${line} L${x(pts.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
    const ticks = Array.from(new Set([hi, 0, lo]));
    return (<svg viewBox={`0 0 ${W} ${H}`} className="rp-trend" role="img" aria-label="Polarity trend over time">
      {ticks.map((tick) => (<g key={tick}>
          <line x1={L} x2={W - R} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? "#b9b4a6" : "#ece8dc"} strokeDasharray={tick === 0 ? "3 3" : undefined}/>
          <text x={L - 5} y={y(tick) + 3} textAnchor="end">{tick.toFixed(2)}</text>
        </g>))}
      <path d={area} fill={color} opacity="0.16"/>
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"/>
      <text x={L} y={H - 4} textAnchor="start">{pts[0].date}</text>
      <text x={W - R} y={H - 4} textAnchor="end">{pts[pts.length - 1].date}</text>
    </svg>);
}
function Voice({ record, color }: {
    record: ScoredRecord;
    color: string;
}) {
    return (<figure className="rp-quote" style={{ borderColor: color }}>
      <blockquote>&ldquo;{record.text.trim()}&rdquo;</blockquote>
      <figcaption>
        polarity {signed(record.source_polarity, 2)}
        {record.subreddit ? ` · ${record.subreddit}` : ""}
        {record.event_date ? ` · ${record.event_date}` : ""}
      </figcaption>
    </figure>);
}
function Sheet({ v }: {
    v: Verdict;
}) {
    const tone = TONE_COLORS_PAPER[v.tone];
    const polarityClass = v.polarity < -0.05 ? "rp-neg" : v.polarity > 0.05 ? "rp-pos" : "";
    const sentiments = [
        { name: "negative", value: v.breakdown.negative, color: SENTIMENT_COLORS.negative },
        { name: "neutral", value: v.breakdown.neutral, color: SENTIMENT_COLORS.neutral },
        { name: "positive", value: v.breakdown.positive, color: SENTIMENT_COLORS.positive },
    ];
    return (<article className="rp-sheet" style={{ ["--tone" as string]: tone }}>
      <div className="rp-top">
        <span className="rp-bar"/>
        <header className="rp-head">
          <div className="rp-brand">
            <span className="rp-mark">V</span>
            <div>
              <b>VERDICTLAB</b>
              <small>SENTIMENT VERDICT REPORT</small>
            </div>
          </div>
          <div className="rp-meta">
            <span>RUN {v.runId}</span>
            <span>{v.generatedOn.toUpperCase()}</span>
          </div>
        </header>

        <h1 className="rp-title">{v.title}</h1>
        <p className="rp-source">{(v.source + (v.dateRange ? `  ·  ${v.dateRange}` : "")).toUpperCase()}</p>

        <div className="rp-verdict">
          <div>
            <p className="rp-eyebrow">THE VERDICT</p>
            <div className="rp-word">{v.word}</div>
          </div>
          <div>
            <p className="rp-headline">{v.headline}</p>
            <p className="rp-plain">{v.plain}</p>
          </div>
        </div>
      </div>

      <div className="rp-body">
        <section className="rp-kpis">
          <Kpi label="MEAN POLARITY" value={signed(v.polarity)} detail={`VADER ${signed(v.vader)}`} valueClass={polarityClass}/>
          <Kpi label="COMMENTS ANALYSED" value={v.totalRecords.toLocaleString()} detail={`${v.uniqueRecords.toLocaleString()} unique after dedup`}/>
          <Kpi label="DOMINANT EMOTION" value={v.emotion ?? "n/a"} detail={v.emotionShare !== null ? `${Math.round(v.emotionShare * 100)}% of comments` : "not available"}/>
          <Kpi label="TOP CONFLICT" value={v.conflict ?? "None detected"} detail={v.conflict ? "most represented" : "no conflict terms found"}/>
        </section>

        <section className="rp-cols">
          <div className="rp-card">
            <h2>Sentiment distribution</h2>
            <p className="rp-sub">Share of unique comments, full dataset</p>
            <div className="rp-stack" role="img" aria-label="Sentiment split">
              {sentiments.map((s) => <i key={s.name} style={{ width: `${s.value}%`, background: s.color }}/>)}
            </div>
            <div className="rp-dist">
              {sentiments.map((s) => (<div key={s.name}>
                  <i style={{ background: s.color }}/>
                  <span>{s.name}</span>
                  <b>{s.value}%</b>
                </div>))}
            </div>
            <p className="rp-check">
              <em>MODEL CHECK</em>
              {v.agreement.text}
            </p>
          </div>

          <div className="rp-card">
            <h2>Polarity over time</h2>
            <p className="rp-sub">3-period rolling mean · below zero = negative</p>
            <TrendChart points={v.trend} color={tone}/>
            <p className="rp-sub rp-tight">
              {v.volatileDay ? `Most volatile: ${v.volatileDay.date} (spread ${v.volatileDay.spread.toFixed(3)})` : "Most volatile day needs dated records."}
            </p>
          </div>
        </section>

        <section className="rp-cols">
          <div className="rp-card">
            <h2>Hourglass of Emotions</h2>
            <p className="rp-sub">Exploratory Hourglass dimension per comment · not human-validated</p>
            <div className="rp-emo">
              {DIMENSION_KEYS.map((key) => (<div key={key}>
                  <span>{DIMENSION_LABELS[key]}</span>
                  <div><i style={{ width: `${Math.round(v.emotionShares[key] * 100)}%`, background: DIMENSION_COLORS[key] }}/></div>
                  <b>{Math.round(v.emotionShares[key] * 100)}%</b>
                </div>))}
            </div>
          </div>

          <div className="rp-card">
            <h2>What people are talking about</h2>
            <p className="rp-sub">Most frequent discussion topics</p>
            {v.topics.length ? (<div className="rp-chips">{v.topics.map((topic) => <span key={topic}>{topic}</span>)}</div>) : (<p className="rp-empty">Not enough signal to extract topics.</p>)}
          </div>
        </section>

        {(v.voices.negative.length > 0 || v.voices.positive.length > 0) && (<section className="rp-card">
            <h2>Voices from the data</h2>
            <p className="rp-sub">The most extreme scored comments on each side</p>
            <div className="rp-voices">
              <div>
                <p className="rp-voice-label" style={{ color: SENTIMENT_COLORS.negative }}>MOST NEGATIVE</p>
                {v.voices.negative.map((r, i) => <Voice key={`n${i}`} record={r} color={SENTIMENT_COLORS.negative}/>)}
              </div>
              <div>
                <p className="rp-voice-label" style={{ color: SENTIMENT_COLORS.positive }}>MOST POSITIVE</p>
                {v.voices.positive.map((r, i) => <Voice key={`p${i}`} record={r} color={SENTIMENT_COLORS.positive}/>)}
              </div>
            </div>
          </section>)}
      </div>

      <footer className="rp-foot">
        <p>
          <b>METHOD</b> Every comment is scored by two independent models (VADER and TextBlob) and cross-checked; Hourglass dimensions are exploratory SenticNet-derived indicators, not validated emotion labels.
          Headline figures cover all {v.uniqueRecords.toLocaleString()} unique records{v.sampleSize < v.uniqueRecords ? `; charts use an evenly spaced sample of ${v.sampleSize.toLocaleString()}` : ""}.
          {v.quality !== null ? ` Data quality ${Math.round(v.quality)}/100.` : ""}
        </p>
        <div className="rp-conf">
          <span>CONFIDENCE</span>
          <b style={{ color: CONFIDENCE_COLORS[v.confidence] }}>{v.confidence.toUpperCase()}</b>
        </div>
      </footer>
    </article>);
}
function ReportInner() {
    const { runId, resolving, error: resolveError } = useActiveRun();
    const autoPrint = useSearchParams().get("print") === "1";
    const [analysis, setAnalysis] = useState<Analysis | null>(null);
    const [results, setResults] = useState<AnalysisResults | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [cardBusy, setCardBusy] = useState(false);
    const printed = useRef(false);
    useEffect(() => {
        if (!runId)
            return;
        let stopped = false;
        setError(null);
        (async () => {
            try {
                const current = await getAnalysis(runId);
                if (stopped)
                    return;
                setAnalysis(current);
                if (current.status !== "complete")
                    return;
                const data = await getResults(runId);
                if (!stopped)
                    setResults(data);
            }
            catch (e) {
                if (stopped)
                    return;
                setError(e instanceof AccountError && (e.status === 404 || e.status === 401)
                    ? "We couldn't find this analysis. It may have been deleted, or you may be signed out."
                    : "Could not load this report. Make sure the backend is running.");
            }
        })();
        return () => { stopped = true; };
    }, [runId]);
    const verdict = useMemo(() => (analysis && results ? buildVerdict(analysis, results) : null), [analysis, results]);
    useEffect(() => {
        if (!verdict)
            return;
        const previous = document.title;
        document.title = `VerdictLab report - ${verdict.title}`;
        return () => { document.title = previous; };
    }, [verdict]);
    useEffect(() => {
        if (!verdict || !autoPrint || printed.current)
            return;
        printed.current = true;
        (async () => {
            try {
                await document.fonts.ready;
            }
            catch { }
            window.setTimeout(() => window.print(), 450);
        })();
    }, [verdict, autoPrint]);
    async function saveCard() {
        if (!verdict || cardBusy)
            return;
        setCardBusy(true);
        try {
            downloadBlob(await renderVerdictCard(verdict), verdictFileName(verdict, "png"));
        }
        finally {
            setCardBusy(false);
        }
    }
    const back = runId ? `/workspace?run=${encodeURIComponent(runId)}` : "/workspace";
    let body: React.ReactNode;
    if (resolving || (runId && !error && !verdict && (!analysis || analysis.status === "complete"))) {
        body = <p className="rp-msg">Building your report…</p>;
    }
    else if (!runId || resolveError) {
        body = !runId ? <NoAnalysisSelected /> : <p className="rp-msg">{resolveError}</p>;
    }
    else if (error) {
        body = <p className="rp-msg">{error}</p>;
    }
    else if (analysis && analysis.status !== "complete") {
        body = <p className="rp-msg">This analysis isn&apos;t finished yet. Come back when the pipeline completes.</p>;
    }
    else if (verdict) {
        body = <div className="rp-scale"><Sheet v={verdict}/></div>;
    }
    else {
        body = <p className="rp-msg">Nothing to report on for this analysis.</p>;
    }
    return (<div className="rp-stage">
      <style dangerouslySetInnerHTML={{ __html: REPORT_CSS }}/>
      <div className="rp-toolbar">
        <a href={back}>← BACK TO DASHBOARD</a>
        <div className="rp-actions">
          <button type="button" className="rp-btn" onClick={saveCard} disabled={!verdict || cardBusy}>{cardBusy ? "RENDERING…" : "DOWNLOAD CARD (PNG)"}</button>
          <button type="button" className="rp-btn primary" onClick={() => window.print()} disabled={!verdict}>SAVE AS PDF</button>
        </div>
        <p className="rp-hint">In the print dialog set the destination to “Save as PDF”. Headers, footers and margins are already handled.</p>
      </div>
      {body}
    </div>);
}
export default function ReportPage() {
    return (<Suspense fallback={null}>
      <ReportInner />
    </Suspense>);
}
const REPORT_CSS = `
@page { size: A4; margin: 0; }

.rp-stage { min-height: 100vh; background: #080b0e; color: #10161c; padding-bottom: 48px; }
.rp-toolbar { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 10px 16px; flex-wrap: wrap; padding: 12px 24px; background: rgba(8,11,14,.94); backdrop-filter: blur(8px); border-bottom: 1px solid #1d242b; }
.rp-toolbar a { color: #9299a1; text-decoration: none; font: 11px "JetBrains Mono", monospace; letter-spacing: .08em; }
.rp-toolbar a:hover { color: #f0ae2a; }
.rp-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.rp-btn { border: 1px solid #2a323a; background: #10161c; color: #d9dde1; border-radius: 7px; padding: 9px 14px; font: 700 12px "JetBrains Mono", monospace; letter-spacing: .06em; cursor: pointer; }
.rp-btn.primary { background: #f0ae2a; border-color: #f0ae2a; color: #111820; }
.rp-btn:hover:not(:disabled) { filter: brightness(1.15); }
.rp-btn:disabled { opacity: .5; cursor: default; }
.rp-hint { flex-basis: 100%; margin: 0; color: #69727b; font: 10.5px "JetBrains Mono", monospace; }
.rp-msg { margin: 80px auto 0; max-width: 520px; padding: 0 24px; color: #9299a1; font: 13px "JetBrains Mono", monospace; text-align: center; }
.rp-scale { display: flex; justify-content: center; padding: 28px 16px 0; }
@media (max-width: 900px) { .rp-scale { zoom: .7; } }
@media (max-width: 640px) { .rp-scale { zoom: .42; padding-left: 0; padding-right: 0; } }

.rp-sheet { --mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace; --serif: Georgia, "Times New Roman", serif; --ink: #10161c; --sub: #6f7780;
  flex: none; width: 210mm; height: 297mm; display: flex; flex-direction: column; overflow: hidden; background: #fbfaf6; color: var(--ink);
  font-family: Inter, ui-sans-serif, system-ui, sans-serif; box-shadow: 0 30px 80px rgba(0,0,0,.55);
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.rp-sheet * { box-sizing: border-box; }

.rp-top { position: relative; overflow: hidden; background: #0b0f14; color: #e7e9eb; padding: 26px 44px 26px; }
.rp-top::before { content: ""; position: absolute; top: -260px; right: -220px; width: 560px; height: 560px; border-radius: 50%; background: radial-gradient(circle, var(--tone) 0%, transparent 65%); opacity: .3; }
.rp-top > * { position: relative; }
.rp-top > .rp-bar { position: absolute; left: 0; right: 0; top: 0; height: 6px; background: var(--tone); }
.rp-head { display: flex; align-items: center; justify-content: space-between; }
.rp-brand { display: flex; align-items: center; gap: 10px; }
.rp-mark { width: 28px; height: 28px; border-radius: 7px; background: #f0ae2a; color: #111820; display: grid; place-items: center; font: 700 14px var(--mono); }
.rp-brand b { display: block; font: 700 12px var(--mono); letter-spacing: .2em; }
.rp-brand small { display: block; margin-top: 3px; font: 8.5px var(--mono); letter-spacing: .16em; color: #7d858d; }
.rp-meta { display: grid; gap: 3px; text-align: right; font: 9.5px var(--mono); letter-spacing: .12em; color: #7d858d; }
.rp-title { margin: 20px 0 5px; font: 700 27px/1.16 var(--serif); letter-spacing: -.02em; color: #e7e9eb; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.rp-source { margin: 0; font: 10px var(--mono); letter-spacing: .06em; color: #8a929a; }
.rp-verdict { display: grid; grid-template-columns: auto 1fr; gap: 30px; align-items: end; margin-top: 22px; }
.rp-eyebrow { margin: 0 0 8px; font: 9.5px var(--mono); letter-spacing: .2em; color: #f0ae2a; }
.rp-word { font: 700 78px/.92 var(--serif); letter-spacing: -.03em; color: var(--tone); }
.rp-headline { margin: 0 0 7px; font: 600 15px/1.42 Inter, sans-serif; color: #e7e9eb; }
.rp-plain { margin: 0; font: 12px/1.5 Inter, sans-serif; color: #9aa2a9; }

.rp-body { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 10px; padding: 16px 44px 0; }
.rp-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.rp-kpi { min-width: 0; padding: 12px 14px; background: #fff; border: 1px solid #e6e2d8; border-radius: 9px; }
.rp-kpi span { display: block; font: 8.5px var(--mono); letter-spacing: .14em; color: var(--sub); }
.rp-kpi strong { display: block; margin-top: 7px; font: 700 22px/1.1 var(--serif); letter-spacing: -.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rp-kpi small { display: block; margin-top: 5px; font: 9px var(--mono); color: var(--sub); }
.rp-neg { color: #d23a30; }
.rp-pos { color: #238a5c; }

.rp-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.rp-card { min-width: 0; padding: 12px 16px; background: #fff; border: 1px solid #e6e2d8; border-radius: 9px; }
.rp-card h2 { margin: 0; font: 700 12.5px Inter, sans-serif; letter-spacing: -.01em; }
.rp-sub { margin: 3px 0 0; font: 9px var(--mono); color: var(--sub); }
.rp-tight { margin-top: 6px; }
.rp-empty { margin: 14px 0 0; font: 11px var(--mono); color: var(--sub); }

.rp-stack { display: flex; height: 14px; margin-top: 12px; border-radius: 7px; overflow: hidden; background: #eee9dc; }
.rp-stack i { display: block; height: 100%; }
.rp-dist { display: grid; gap: 6px; margin-top: 11px; }
.rp-dist div { display: flex; align-items: center; gap: 8px; font-size: 11px; text-transform: capitalize; }
.rp-dist i { width: 9px; height: 9px; border-radius: 2px; }
.rp-dist b { margin-left: auto; font: 600 11px var(--mono); }
.rp-check { margin: 12px 0 0; padding: 8px 10px; border-radius: 7px; background: #f4f1e8; font-size: 10px; line-height: 1.5; color: #3f4952; }
.rp-check em { display: block; margin-bottom: 2px; font: normal 8px var(--mono); letter-spacing: .16em; color: var(--sub); }

.rp-trend { display: block; width: 100%; height: auto; margin-top: 8px; }
.rp-trend text { font: 8px var(--mono); fill: #7b838b; }

.rp-emo { display: grid; gap: 9px; margin-top: 12px; }
.rp-emo > div { display: grid; grid-template-columns: 84px 1fr 34px; align-items: center; gap: 8px; font-size: 11px; }
.rp-emo > div > div { height: 8px; border-radius: 4px; background: #eee9dc; overflow: hidden; }
.rp-emo i { display: block; height: 100%; border-radius: 4px; }
.rp-emo b { text-align: right; font: 600 10.5px var(--mono); }

.rp-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.rp-chips span { padding: 4px 10px; border: 1px solid #e0dccf; border-radius: 999px; background: #faf8f1; font: 10.5px var(--mono); color: #3f4952; }

.rp-voices { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 10px; }
.rp-voice-label { margin: 0 0 7px; font: 700 8.5px var(--mono); letter-spacing: .16em; }
.rp-quote { margin: 0 0 9px; padding-left: 10px; border-left: 3px solid #ccc; }
.rp-quote blockquote { margin: 0; font: italic 11px/1.45 var(--serif); color: #2b333a; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.rp-quote figcaption { margin-top: 3px; font: 8.5px var(--mono); color: var(--sub); }

.rp-foot { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin: 10px 44px 0; padding: 10px 0 18px; border-top: 1px solid #e6e2d8; }
.rp-foot p { margin: 0; font: 8.5px/1.6 var(--mono); color: var(--sub); }
.rp-foot p b { margin-right: 6px; letter-spacing: .14em; color: var(--ink); }
.rp-conf { flex: none; padding: 7px 12px; border-radius: 8px; background: #0b0f14; text-align: center; }
.rp-conf span { display: block; font: 7.5px var(--mono); letter-spacing: .18em; color: #7d858d; }
.rp-conf b { display: block; margin-top: 3px; font: 700 12px var(--mono); letter-spacing: .1em; color: #e7e9eb; }

@media print {
  html, body { background: #fff !important; }
  .rp-toolbar { display: none !important; }
  .rp-stage { background: #fff; padding: 0; min-height: 0; }
  .rp-scale { display: block; padding: 0 !important; zoom: 1 !important; }
  .rp-sheet { height: 296.6mm; box-shadow: none; break-after: avoid; page-break-after: avoid; }
}
`;
