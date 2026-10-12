"use client";
import { Suspense, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Area, AreaChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import PipelineCard from "@/components/PipelineCard";
import DashboardSidebar from "@/components/DashboardSidebar";
import AnalysisFilters from "@/components/AnalysisFilters";
import PulseTour from "@/components/PulseTour";
import GlossaryModal from "@/components/GlossaryModal";
import ExportMenu from "@/components/ExportMenu";
import { AccountError, clearLastRunId, deleteAnalysis, getAnalysis, getReport, getResults, setLastRunId, type Analysis, type AnalysisResults } from "@/lib/api";
import { useActiveRun } from "@/lib/useActiveRun";
import { DIMENSION_KEYS, DIMENSION_LABELS, type DimensionKey, dailySeries, dominantEmotion, emotionShares, formatDate, mean, mostVolatileDay, sentimentBreakdown, topConflict, useSliceFilters } from "@/lib/analysisData";
import { countKinds, kindOf, recordNouns } from "@/lib/recordKind";
import PostsVsComments from "@/components/PostsVsComments";
import { isDemoPath } from "@/lib/demo";
import NoAnalysisSelected from "@/components/NoAnalysisSelected";
function WorkspaceInner() {
    const router = useRouter();
    const { runId, resolving, error: resolveError, retry } = useActiveRun();
    const [deleting, setDeleting] = useState(false);
    const [analysis, setAnalysis] = useState<Analysis | null>(null);
    const [results, setResults] = useState<AnalysisResults | null>(null);
    const [report, setReport] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        if (!runId)
            return;
        const analysisId = runId;
        setAnalysis(null);
        setResults(null);
        setReport(null);
        let stopped = false;
        async function poll() {
            try {
                const current = await getAnalysis(analysisId);
                if (stopped)
                    return;
                if (current.is_demo && !isDemoPath(window.location.pathname)) {
                    router.replace("/demo");
                    return;
                }
                setAnalysis(current);
                setError(null);
                setLastRunId(analysisId);
                if (current.status === "complete") {
                    const [nextResults, nextReport] = await Promise.all([getResults(analysisId), getReport(analysisId)]);
                    if (!stopped) {
                        setResults(nextResults);
                        setReport(nextReport.report_markdown);
                    }
                }
                else if (current.status !== "failed") {
                    window.setTimeout(poll, 1200);
                }
            }
            catch (pollError) {
                if (stopped)
                    return;
                if (pollError instanceof AccountError && (pollError.status === 404 || pollError.status === 401)) {
                    clearLastRunId();
                    router.replace("/workspace/list");
                    return;
                }
                setError(pollError instanceof Error ? pollError.message : "Could not load this analysis.");
            }
        }
        poll();
        return () => { stopped = true; };
    }, [runId, router]);
    async function handleDelete() {
        if (!runId || deleting)
            return;
        if (!window.confirm("Delete this analysis? This can't be undone."))
            return;
        setDeleting(true);
        try {
            await deleteAnalysis(runId);
            clearLastRunId();
            router.replace("/workspace/list");
        }
        catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : "Could not delete this analysis.");
        }
        finally {
            setDeleting(false);
        }
    }
    return (<div className="pulse-app">
      <DashboardSidebar runId={runId}/>
      <div className="dashboard-shell">
        <main className="dashboard-content">
          <p className="eyebrow">01 · PULSE / DECISION SUPPORT</p>
          <div className="page-head">
            <div>
              <h1>Know what changed. Know what to check next.</h1>
              <p className="dashboard-subtitle">VerdictLab helps researchers, journalists, policy teams, and moderators decide what deserves human attention in a public conversation—not just whether the tone is positive or negative.</p>
            </div>
            {runId && (<div className="page-head-actions">
                {analysis?.status === "complete" && results?.result_summary && <ExportMenu analysis={analysis} results={results}/>}
                <button type="button" onClick={handleDelete} disabled={deleting} className="pulse-delete font-mono text-xs uppercase tracking-wider text-muted hover:text-alert">{deleting ? "Deleting…" : "Delete analysis"}</button>
              </div>)}
          </div>
          {resolving ? (<PulseIdle><div className="timeline-chart-empty">Loading your analysis…</div></PulseIdle>) : !runId && resolveError ? (<PulseIdle>
              <div className="timeline-chart-empty">
                <div>
                  <p>{resolveError}</p>
                  <button type="button" onClick={retry} className="mt-6 bg-signal text-ink font-medium px-5 py-3 rounded-sm">RETRY</button>
                </div>
              </div>
            </PulseIdle>) : !runId ? (<PulseIdle><NoAnalysisSelected /></PulseIdle>) : (<>
              {analysis && analysis.status !== "complete" && <PipelineCard analysisId={runId}/>}
              {analysis?.status === "failed" && <p className="text-alert font-mono text-sm mt-4">{analysis.error}</p>}
              {error && <p className="text-alert font-mono text-sm mt-4">{error}</p>}
              {results?.result_summary && <DashboardResults analysis={analysis} results={results} report={report}/>}
            </>)}
        </main>
      </div>
    </div>);
}
function PulseIdle({ children }: {
    children: ReactNode;
}) {
    const { filters, setFilters, defaults, conflictOptions, subredditOptions, kindCounts } = useSliceFilters(null);
    const [tourOpen, setTourOpen] = useState(false);
    const [glossaryOpen, setGlossaryOpen] = useState(false);
    return <>
    <DashboardGuide />
    <div className="pulse-toolbar">
      <button type="button" className="tour-trigger" onClick={() => setTourOpen(true)}>▶ TAKE THE 60-SECOND TOUR</button>
      <button type="button" className="glossary-trigger" onClick={() => setGlossaryOpen(true)}>📖 GLOSSARY</button>
      <div className="polarity-scale" aria-hidden="true"><span>-1 angry</span><i /><span>+1 happy</span></div>
    </div>
    {tourOpen && <PulseTour onClose={() => setTourOpen(false)}/>}
    {glossaryOpen && <GlossaryModal onClose={() => setGlossaryOpen(false)}/>}
    <AnalysisFilters filters={filters} onChange={setFilters} defaults={defaults} subredditOptions={subredditOptions} conflictOptions={conflictOptions} kindCounts={kindCounts}/>
    {children}
  </>;
}
function DashboardResults({ analysis, results, report }: {
    analysis: Analysis | null;
    results: AnalysisResults;
    report: string | null;
}) {
    const summary = results.result_summary!;
    const { records, filtered, filters, setFilters, defaults, conflictOptions, subredditOptions, kindCounts } = useSliceFilters(results);
    const nouns = recordNouns(countKinds(filtered.length ? filtered : records));
    const breakdown = useMemo(() => sentimentBreakdown(filtered), [filtered]);
    const meanPolarity = useMemo(() => mean(filtered.map((record) => record.source_polarity)), [filtered]);
    const meanVader = useMemo(() => mean(filtered.map((record) => record.vader_score)), [filtered]);
    const trendData = useMemo(() => dailySeries(filtered).map((point) => ({ date: point.date, polarity: point.polarity })), [filtered]);
    const trendBand = useMemo(() => {
        if (!trendData.length)
            return null;
        const values = trendData.map((point) => point.polarity);
        const avg = mean(values);
        const std = Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
        return { low: avg - std, high: avg + std };
    }, [trendData]);
    const shares = useMemo(() => emotionShares(filtered), [filtered]);
    const topEmotion = useMemo(() => dominantEmotion(filtered), [filtered]);
    const conflictTop = useMemo(() => topConflict(filtered), [filtered]);
    const volatile = useMemo(() => mostVolatileDay(filtered), [filtered]);
    const dominant = (Object.entries(breakdown).sort(([, a], [, b]) => b - a)[0] ?? ["neutral", 0])[0] as keyof typeof breakdown;
    const recentRows = useMemo(() => [...filtered].sort((a, b) => (b.event_date ?? "").localeCompare(a.event_date ?? "")).slice(0, 8), [filtered]);
    const truncated = summary.records_after_dedup > records.length;
    const [tourOpen, setTourOpen] = useState(false);
    const [glossaryOpen, setGlossaryOpen] = useState(false);
    return <>
    <DashboardGuide summary={summary} recordCount={filtered.length}/>
    <div className="pulse-toolbar">
      <button type="button" className="tour-trigger" onClick={() => setTourOpen(true)}>▶ TAKE THE 60-SECOND TOUR</button>
      <button type="button" className="glossary-trigger" onClick={() => setGlossaryOpen(true)}>📖 GLOSSARY</button>
      <div className="polarity-scale" aria-hidden="true"><span>-1 angry</span><i /><span>+1 happy</span></div>
    </div>
    {tourOpen && <PulseTour onClose={() => setTourOpen(false)}/>}
    {glossaryOpen && <GlossaryModal onClose={() => setGlossaryOpen(false)}/>}
    <AnalysisFilters filters={filters} onChange={setFilters} defaults={defaults} subredditOptions={subredditOptions} conflictOptions={conflictOptions} kindCounts={kindCounts}/>
    {!filtered.length ? <p className="empty-state">No records match the current filters.</p> : <>
    <section className="insight" data-tour="insight"><div className="insight-icon">⌁</div><div><label>WHAT THIS MEANS</label><p><b>{dominant}</b> sentiment is the largest signal in this slice of your uploaded dataset, representing {breakdown[dominant]}% of {filtered.length.toLocaleString()} unique records.</p><p className="insight-plain">In plain English: {dominant === "negative" ? (breakdown.negative > 50 ? "more than half of the comments sound upset, critical or hostile." : "the largest group of comments sounds upset, critical or hostile.") : dominant === "positive" ? "the largest group of comments sounds supportive or hopeful." : "the largest group of comments is factual or emotionally flat."}</p><p className="insight-action"><b>Next:</b> open the supporting detail below and read the representative comments before deciding what to change or communicate.</p></div></section>
    <section className="metrics" data-tour="metrics">
      <Metric label="MEAN POLARITY" info={INFO.meanPolarity} value={meanPolarity.toFixed(3)} accent={meanPolarity < 0} detail={`VADER ${meanVader.toFixed(3)}`}/>
      <Metric label={`${nouns.plural.toUpperCase()} ANALYSED`} info={INFO.commentsAnalysed} value={summary.total_records.toLocaleString()} detail={`${filtered.length.toLocaleString()} in this slice · ${summary.records_after_dedup.toLocaleString()} unique`}/>
      <Metric label="TOP CONFLICT" info={INFO.topConflict} value={conflictTop ?? "None detected"} detail={conflictTop ? "most represented conflict" : "no conflict terms found in the text"}/>
      <Metric label="DOMINANT EMOTION" info={INFO.dominantEmotion} value={topEmotion ? DIMENSION_LABELS[topEmotion] : "Not available"} detail="most frequent Hourglass dimension"/>
      <Metric label="MOST VOLATILE DAY" info={INFO.volatileDay} value={volatile?.date ?? "Not available"} detail={volatile ? `Polarity spread: ${volatile.spread.toFixed(3)}` : "needs dated records"}/>
    </section>
    <section className="analysis-grid">
      <div className="panel" data-tour="trend"><PanelHeading title="When did public opinion change?" subtitle="3-day rolling mean across the filtered slice" info={INFO.rollingPolarity}/><RollingPolarityChart data={trendData} band={trendBand}/><HowToRead>The <b>line</b> is average mood per day. <b>Below the zero line = negative.</b> The shaded band is the normal range; points outside it are unusual days worth investigating.</HowToRead><DecisionPrompt>Use the unusual date as your starting point: open the comments below to see what may have triggered the change.</DecisionPrompt></div>
      <div className="panel distribution" data-tour="distribution"><PanelHeading title="How is the conversation split by tone?" subtitle="Share of unique uploaded records in this slice" info={INFO.sentimentDistribution}/>{(["negative", "neutral", "positive"] as const).map((label) => <DistributionRow key={label} label={label} value={breakdown[label]}/>)}<HowToRead>Each comment is sorted into one bucket. The three bars <b>always add up to 100%</b>.</HowToRead><DecisionPrompt>Use this split to choose the review depth: a mostly negative slice needs examples and context, not an automatic conclusion.</DecisionPrompt><p className="coverage">Computed from {filtered.length.toLocaleString()} cleaned records. Scores use VADER and TextBlob for cross-checking.{truncated && ` Figures use an evenly spaced sample of ${records.length.toLocaleString()} of ${summary.records_after_dedup.toLocaleString()} unique records.`}</p></div>
    </section>
    <details className="supporting-analysis">
      <summary>
        <span>
          <b>Explore supporting detail</b>
          <small>Emotion mix, recent comments, and post-versus-comment context</small>
        </span>
        <i aria-hidden="true">+</i>
      </summary>
      <div className="supporting-analysis-body">
        <PostsVsComments records={filtered}/>
        <section className="lower-grid">
      <div className="panel hourglass-panel" data-tour="hourglass"><PanelHeading title="What emotions are driving the discussion?" subtitle="Share of comments whose dominant emotion dimension is each one" info={INFO.hourglassMix}/><div className="hourglass-chart"><div className="hourglass-axis"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div><div className="hourglass-rows is-share">{DIMENSION_KEYS.map((key) => <div className="hourglass-row" key={key}><span>{DIMENSION_LABELS[key]}</span><div className="hourglass-track" title={`${DIMENSION_LABELS[key]}: ${(shares[key] * 100).toFixed(1)}%`}><i className={`share ${key === "sensitivity" ? "negative" : key === "pleasantness" ? "positive" : "blue"}`} style={{ width: `${shares[key] * 100}%` }}/></div></div>)}</div></div><HowToRead><b>Longest bar</b> = the feeling that dominates the conversation.{topEmotion && <> Here {EMOTION_WORDS[topEmotion]} (<b>{DIMENSION_LABELS[topEmotion]}</b>) lead.</>}</HowToRead></div>
      <div className="panel events-panel" data-tour="comments"><PanelHeading title="Recent comments" subtitle="Latest scored comments in this slice" info={INFO.recentComments}/><div className="event-list">{recentRows.map((record, index) => <div className="event-row" key={`${record.text}-${index}`}><span className="event-date">{formatDate(record.event_date) ?? `ROW ${String(index + 1).padStart(2, "0")}`}</span><i className={`event-dot ${record.source_polarity < 0 ? "negative" : ""}`}/><div><b>{record.text}</b><p>{kindOf(record) !== "unknown" && <>{kindOf(record).toUpperCase()} · </>}{record.label} · VADER {record.vader_score.toFixed(2)}</p></div><span className={`event-meta ${record.source_polarity < 0 ? "negative" : "positive"}`}>{record.conflict && <em>{record.conflict}</em>}{record.source_polarity >= 0 ? "+" : ""}{record.source_polarity.toFixed(2)}</span></div>)}</div><HowToRead><b>Green dot</b> = positive tone, <b>red dot</b> = negative. Use these to sanity-check the charts.</HowToRead></div>
        </section>
      </div>
    </details>
    </>}
  </>;
}
function DashboardGuide({ summary, recordCount }: {
    summary?: NonNullable<AnalysisResults["result_summary"]>;
    recordCount?: number;
}) {
    const confidence = summary?.quality_score;
    const reportedSubject = summary?.top_conflict && summary.top_conflict !== "Not available" ? summary.top_conflict : "conversation";
    const sentiment = summary?.sentiment_breakdown;
    const negativeShare = sentiment?.negative ?? 0;
    const positiveShare = sentiment?.positive ?? 0;
    const neutralShare = sentiment?.neutral ?? 0;
    const dominantTone = negativeShare >= positiveShare && negativeShare >= neutralShare
        ? "negative"
        : positiveShare >= neutralShare ? "positive" : "neutral";
    const benchmark = summary?.trust_benchmark;
    const confidenceLabel = confidence === null || confidence === undefined
        ? "Exploratory"
        : confidence >= 0.75
            ? "Higher confidence"
            : confidence >= 0.5
                ? "Use with context"
                : "Early signal";
    return <section className="dashboard-guide" aria-labelledby="dashboard-guide-title">
      <div className="guide-main">
        <div>
          <p className="guide-eyebrow">THE VERDICTLAB PROMISE</p>
          <h2 id="dashboard-guide-title">Should you act on this signal—or investigate it first?</h2>
          <p className="guide-lede">
            {summary
                ? <>We found a <b>{reportedSubject}</b> signal, then unpacked its tone, emotional driver, timing, and uncertainty so you can choose a defensible next question.</>
                : <>VerdictLab turns a file or public conversation into a plain-language view of what changed, why it may have changed, and where automated analysis should not be trusted.</>}
          </p>
        </div>
        <a className="guide-next" href={summary ? "#evidence" : "/workspace/access"}>
          <span>{summary ? "YOUR NEXT ACTION" : "FIRST ACTION"}</span>
          <b>{summary ? "Verify the signal ↓" : "Run your first analysis →"}</b>
        </a>
      </div>
      <div className="story-intro">
        <div className="story-problem">
        <span className="story-kicker">THE PROBLEM</span>
        <h3>“Positive” can be the wrong answer.</h3>
        <p>Most sentiment tools flatten a conversation into one label. That misses the difficult cases: polite wording, sarcasm, disagreement, and the emotional shift between an original post and its replies.</p>
        </div>
        <div className="story-verdict">
        <span className="story-kicker">THE DECISION IT UNLOCKS</span>
        <p>What should a human investigate before making a public-facing decision?</p>
        <strong>{summary ? `${dominantTone.toUpperCase()} is the headline. Find the driver before you respond.` : "Go beyond good vs bad to find the next question."}</strong>
        </div>
      </div>
      <div className="before-after" aria-label="From raw conversation to human decision">
        <div className="before-after-step">
          <span className="story-kicker">BEFORE VERDICTLAB</span>
          <strong>{summary ? `${summary.total_records.toLocaleString()} raw records` : "Thousands of raw comments"}</strong>
          <p>Important changes are buried in volume. It is hard to compare groups or know which comment deserves attention.</p>
        </div>
        <span className="before-after-arrow" aria-hidden="true">→</span>
        <div className="before-after-step before-after-step--accent">
          <span className="story-kicker">AFTER VERDICTLAB</span>
          <strong>{summary ? `${dominantTone} signal + evidence` : "One finding with evidence"}</strong>
          <p>Start with the finding, inspect the change, then review linked examples before a human makes the call.</p>
        </div>
      </div>
      {summary && <div className="story-proof">
        <div className="story-proof-card story-proof-card--signal">
        <span className="story-number">01</span>
        <div><b>The easy answer</b><strong>{dominantTone} tone</strong><p>{negativeShare}% negative · {neutralShare}% neutral · {positiveShare}% positive</p></div>
        </div>
        <div className="story-proof-card">
        <span className="story-number">02</span>
        <div><b>What we add</b><strong>Four emotional lenses</strong><p>Attention, sensitivity, pleasantness, and aptitude expose what polarity hides.</p></div>
        </div>
        <div className="story-proof-card">
        <span className="story-number">03</span>
        <div><b>What earns trust</b><strong>{benchmark ? `${benchmark.labelled_records} labelled examples` : "Evidence before certainty"}</strong><p>{benchmark ? `Benchmarked against human labels: SenticNet ${benchmark.accuracy_pct.senticnet}% · VADER ${benchmark.accuracy_pct.vader}%.` : "Every headline is linked to trends and representative records below."}</p></div>
        </div>
      </div>}
      <div className="story-audience">
        <div><span className="story-kicker">WHO THIS IS FOR</span><p>Researchers, journalists, policy teams, moderators, and analysts deciding <b>what deserves human attention next</b>.</p></div>
        <div><span className="story-kicker">WHY EXISTING TOOLS FALL SHORT</span><p>A single sentiment label hides disagreement, emotional drivers, timing, and model blind spots. VerdictLab keeps those signals visible before anyone overreacts.</p></div>
      </div>
      <div className="comparison-strip">
        <span className="story-kicker">WHY THIS IS NOT JUST AN AI SUMMARY</span>
        <div><b>Summary tools</b><p>Give you a conclusion.</p></div>
        <div><b>VerdictLab</b><p>Shows the change, links the evidence, exposes uncertainty, and tells you what to review next.</p></div>
      </div>
      <div className="guide-steps" aria-label="How VerdictLab works">
        <div><span>01</span><b>Input</b><p>{summary ? `${summary.total_records.toLocaleString()} records uploaded` : "Upload a CSV or connect a source"}</p></div>
        <div><span>02</span><b>Context</b><p>Separate posts from replies, conflicts, dates, and duplicate text</p></div>
        <div><span>03</span><b>Explain</b><p>Cross-check tone with four emotional dimensions and model agreement</p></div>
        <div><span>04</span><b>Decide</b><p>Choose what needs a human read, response, or follow-up</p></div>
      </div>
      <div className="guide-status">
        <div><span className="guide-status-icon">✓</span><p><b>How sure are we?</b> {confidenceLabel}{confidence !== null && confidence !== undefined ? ` · ${Math.round(confidence * 100)}% data-quality score` : " · no human-labelled accuracy score is configured yet"}</p></div>
        <div><span className="guide-status-icon">!</span><p><b>What can this not tell you?</b> It shows patterns in the uploaded text, not what every person believes or what caused the conversation to change.</p></div>
      </div>
      {benchmark?.sarcasm_failure && <div className="story-limit">
        <span className="story-kicker">THE DIFFICULT EXAMPLE</span>
        <p>“{benchmark.sarcasm_failure.text}”</p>
        <div><b>Human label: {benchmark.sarcasm_failure.human_label}</b><span>SenticNet: {benchmark.sarcasm_failure.predictions.senticnet}</span><span>VADER: {benchmark.sarcasm_failure.predictions.vader}</span></div>
      </div>}
      <details className="guide-details" id="evidence">
        <summary>Show the evidence and technical detail</summary>
        <div className="guide-details-body">
          <p><b>Evidence:</b> charts use cleaned, scored records{recordCount !== undefined ? ` (${recordCount.toLocaleString()} currently match your filters)` : ""}. Recent comments let you sanity-check whether the summary matches the underlying text.</p>
          <p><b>Confidence:</b> the quality score describes data quality, not model accuracy. Accuracy claims require an independently labelled evaluation set.</p>
          <p><b>Limitations:</b> sarcasm, slang, missing context, language and uneven sampling can change the result. Treat small slices as signals to investigate, not final conclusions.</p>
        </div>
      </details>
    </section>;
}
type InfoContent = {
    title: string;
    body: React.ReactNode;
};
const EMOTION_WORDS: Record<DimensionKey, string> = {
    pleasantness: "joy and sadness",
    attention: "interest and surprise",
    sensitivity: "fear and anger",
    aptitude: "trust and disgust",
};
const INFO: Record<string, InfoContent> = {
    meanPolarity: { title: "Mean polarity", body: <>The <b>average tone</b> of every comment in the current slice, from <b>-1</b> (very negative) to <b>+1</b> (very positive). Around 0 is neutral. It turns red when the crowd leans negative. The VADER figure underneath is a second, independent scorer used as a cross-check.</> },
    commentsAnalysed: { title: "Comments analysed", body: <>How many comments were scored in total. The line below shows how many are in the <b>current slice</b> (after your filters) and how many are <b>unique</b> once duplicates are removed.</> },
    topConflict: { title: "Top conflict", body: <>The conflict mentioned most often in this slice. It is detected by matching conflict-related terms in the comment text. If none are found it reads &ldquo;None detected&rdquo;.</> },
    dominantEmotion: { title: "Dominant emotion", body: <>The <b>Hourglass of Emotions</b> dimension (Pleasantness, Attention, Sensitivity or Aptitude) that is the strongest feeling in the largest number of comments.</> },
    volatileDay: { title: "Most volatile day", body: <>The day when opinions were <b>furthest apart</b>. The polarity spread is the gap between the most positive and the most negative comment that day, so a bigger number means a more divided conversation.</> },
    rollingPolarity: { title: "Rolling polarity", body: <>Average mood per day, <b>smoothed over 3 days</b> so one odd day does not dominate. Below zero means negative. The shaded band is the normal range (average &plusmn; one standard deviation); points outside it are unusual days.</> },
    sentimentDistribution: { title: "Sentiment distribution", body: <>Every unique comment is sorted into exactly one bucket: <b>negative</b>, <b>neutral</b> or <b>positive</b>. The three bars always add up to 100%.</> },
    hourglassMix: { title: "Hourglass mix", body: <>Goes beyond good vs bad. Each comment is tagged with the emotion dimension that dominates it, and each bar shows that dimension&rsquo;s share of all comments: Pleasantness (joy/sadness), Attention (interest/surprise), Sensitivity (fear/anger), Aptitude (trust/disgust).</> },
    recentComments: { title: "Recent comments", body: <>The <b>8 latest</b> scored comments in this slice, with their date, label, VADER score and polarity. Read them to check the numbers against what people actually wrote.</> },
};
function InfoTip({ title, children }: {
    title: string;
    children: React.ReactNode;
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
function HowToRead({ children }: {
    children: React.ReactNode;
}) { return <p className="how-to-read"><span>HOW TO READ</span><span>{children}</span></p>; }
function DecisionPrompt({ children }: {
    children: React.ReactNode;
}) { return <p className="decision-prompt"><span>NEXT DECISION</span><span>{children}</span></p>; }
function PanelHeading({ title, subtitle, info }: {
    title: string;
    subtitle: string;
    info?: InfoContent;
}) { return <div className="panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div>{info && <InfoTip title={info.title}>{info.body}</InfoTip>}</div>; }
function Metric({ label, value, detail, accent, info }: {
    label: string;
    value: string;
    detail: string;
    accent?: boolean;
    info?: InfoContent;
}) { return <div className="metric"><span className="metric-label">{label}{info && <InfoTip title={info.title}>{info.body}</InfoTip>}</span><strong className={accent ? "accent" : ""}>{value}</strong><small>{detail}</small></div>; }
function DistributionRow({ label, value }: {
    label: string;
    value: number;
}) { return <div className="distribution-row"><div><span>{label}</span><b>{value}%</b></div><div className="distribution-track" title={`${label}: ${value}%`}><i className={label === "negative" ? "red" : label === "neutral" ? "blue" : "green"} style={{ width: `${value}%` }}/></div></div>; }
type TrendPoint = {
    date: string;
    polarity: number;
};
function RollingPolarityChart({ data, band }: {
    data: TrendPoint[];
    band: {
        low: number;
        high: number;
    } | null;
}) {
    if (!data.length)
        return <div className="trend-chart-empty">Not enough dated records to chart a trend yet.</div>;
    return (<div className="trend-chart-recharts">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 12, right: 16, left: 4, bottom: 4 }}>
          <defs>
            <linearGradient id="polarityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f0ae2a" stopOpacity={0.35}/>
              <stop offset="100%" stopColor="#f0ae2a" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#202931" strokeDasharray="1.5 1.5" vertical={false}/>
          <XAxis dataKey="date" tick={{ fill: "#65717a", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} axisLine={{ stroke: "#202931" }} tickLine={false} minTickGap={56}/>
          <YAxis domain={["dataMin - 0.05", "dataMax + 0.05"]} tickFormatter={(value: number) => value.toFixed(2)} tick={{ fill: "#65717a", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} axisLine={false} tickLine={false} width={44}/>
          {band && <ReferenceArea y1={band.low} y2={band.high} fill="#f0ae2a" fillOpacity={0.12} strokeOpacity={0}/>}
          <Tooltip content={<PolarityTooltip />} cursor={{ stroke: "#e7e9eb", strokeWidth: 1 }}/>
          <Area type="monotone" dataKey="polarity" stroke="#f0ae2a" strokeWidth={1.4} fill="url(#polarityFill)" dot={false} activeDot={{ r: 4, fill: "#f0ae2a", stroke: "#0b0f14", strokeWidth: 2 }}/>
        </AreaChart>
      </ResponsiveContainer>
    </div>);
}
function PolarityTooltip({ active, payload, label }: {
    active?: boolean;
    payload?: {
        value: number;
    }[];
    label?: string;
}) {
    if (!active || !payload?.length)
        return null;
    return (<div className="chart-tooltip">
      <span className="chart-tooltip-date">{label}</span>
      <span className="chart-tooltip-value">polarity : {payload[0].value.toFixed(3)}</span>
    </div>);
}
export default function WorkspacePage() { return <main className="min-h-screen bg-ink"><Suspense fallback={null}><WorkspaceInner /></Suspense></main>; }
