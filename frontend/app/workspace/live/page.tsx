"use client";
import { Suspense, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, } from "recharts";
import DashboardSidebar from "@/components/DashboardSidebar";
import AnalysisFilters, { conflicts, type AnalysisFilterState } from "@/components/AnalysisFilters";
import InfoTip, { type InfoContent } from "@/components/InfoTip";
import PulseTour, { type TourStep } from "@/components/PulseTour";
import GlossaryModal, { type GlossaryItem } from "@/components/GlossaryModal";
import { analyseLive, type LiveResult } from "@/lib/api";
import { useActiveRun } from "@/lib/useActiveRun";
import { useDetectedSubreddits } from "@/lib/subreddits";
import { useMediaQuery } from "@/lib/useMediaQuery";
const DEFAULT_FILTERS: AnalysisFilterState = {
    selectedConflicts: conflicts,
    selectedSubreddits: [],
    startDate: "2024-01-01",
    endDate: "2025-03-31",
    keyword: "",
};
const EXAMPLES = [
    "Cautiously hopeful that the ceasefire holds through the weekend. Families are finally being released.",
    "Another strike on a hospital. Children are dying and the world just watches. It is unbearable.",
    "The court ruling is imperfect, but the enforcement guardrails are a meaningful diplomatic step.",
];
const DEBOUNCE_MS = 450;
const LIVE_TOUR_STEPS: TourStep[] = [
    { target: "live-input", title: "Type or paste text", body: "Write any English sentence, or click Example 1, 2 or 3 to load a sample. The score updates by itself a moment after you stop typing. Clear empties the box." },
    { target: "live-scores", title: "Three scores", body: "SenticNet is the main score. VADER and TextBlob are two independent baselines shown beside it. Each runs from -1 (very negative) to +1 (very positive): green is positive, red is negative, grey is neutral." },
    { target: "live-radar", title: "Hourglass radar", body: "How strongly the text shows each of the four emotion dimensions: Pleasantness, Attention, Sensitivity and Aptitude. The further the shape reaches toward a corner, the stronger that emotion." },
    { target: "live-coverage", title: "Concept coverage", body: "How much of your sentence the SenticNet vocabulary understood. If coverage is too low, the tool automatically falls back to VADER so the score stays reliable." },
];
const LIVE_GLOSSARY: GlossaryItem[] = [
    { term: "Live Analyser", plain: "A one-sentence version of the whole pipeline.", detail: "It scores whatever you type using the same backend that scores your uploaded file, so you can test how the system reads a comment." },
    { term: "Polarity", plain: "How positive or negative a text is.", detail: "A score from -1 (very negative) to +1 (very positive). Around 0 is neutral." },
    { term: "Label", plain: "The verdict shown at the top right of the Score panel.", detail: "Positive, negative or neutral, based on the polarity score." },
    { term: "SenticNet", plain: "The main scoring tool, built on a knowledge base of concepts and their emotions.", detail: "It looks at meaning, not just individual words, so it can handle phrases such as cautiously hopeful." },
    { term: "VADER", plain: "A ready-made scorer for short, informal text.", detail: "Good with social media language, capitals and punctuation. Used as a baseline and as the fallback." },
    { term: "TextBlob", plain: "A second, simple sentiment scorer.", detail: "Used as another baseline. When the three scores agree, you can trust the result more." },
    { term: "Baseline", plain: "A simpler tool used for comparison.", detail: "VADER and TextBlob show whether the main score is in line with common tools." },
    { term: "Hourglass of Emotions", plain: "A model that describes feelings along four dimensions.", detail: "The radar shows how strongly the text expresses each one." },
    { term: "Pleasantness", plain: "Joy vs sadness.", detail: "Is the writer happy or upset?" },
    { term: "Attention", plain: "Interest vs surprise or boredom.", detail: "How engaged or alert the writer sounds." },
    { term: "Sensitivity", plain: "Fear and anger.", detail: "How emotionally reactive the text is. High sensitivity often means distress." },
    { term: "Aptitude", plain: "Trust vs disgust.", detail: "How much the writer accepts or rejects what they are talking about." },
    { term: "Concept coverage", plain: "The share of your text that SenticNet recognises.", detail: "Higher coverage means the SenticNet score is based on more of what you wrote." },
    { term: "Threshold", plain: "The minimum coverage needed to trust SenticNet.", detail: "Below it the tool switches to VADER. The current threshold is shown in the note under the radar." },
    { term: "Fallback", plain: "Switching to a backup scorer.", detail: "When SenticNet understands too little of the text, VADER's score is used instead." },
    { term: "Real time", plain: "The score refreshes as you type.", detail: "It waits a fraction of a second after you stop typing, then rescores." },
];
const INFO: Record<"input" | "score" | "senticnet" | "vader" | "textblob" | "coverage", InfoContent> = {
    input: { title: "Input", body: <>Type or paste <b>any English text</b> (up to 2,000 characters), such as a Reddit comment, a news quote or your own writing. It is <b>scored automatically</b> a moment after you stop typing. The <b>Example</b> buttons load ready-made sentences and <b>Clear</b> empties the box.</> },
    score: { title: "Score", body: <>The full read of your text: <b>three polarity scores</b> (SenticNet plus two baselines), an overall <b>label</b> at the top right, the <b>Hourglass radar</b> showing which emotions are present, and a note on <b>concept coverage</b>.</> },
    senticnet: { title: "SenticNet", body: <>The <b>main score</b>, from -1 (very negative) to +1 (very positive). It uses a knowledge base of concepts and emotions, so it reads <b>meaning</b> rather than single words. If it understands too little of your text, VADER&rsquo;s score is used instead.</> },
    vader: { title: "VADER", body: <>A <b>baseline scorer</b> built for short, informal text, and good with capitals and punctuation. Shown as a second opinion, and used as the <b>fallback</b> when SenticNet coverage is low.</> },
    textblob: { title: "TextBlob", body: <>A second <b>baseline scorer</b> that uses a simple word list. If it <b>agrees</b> with SenticNet and VADER, the result is more trustworthy; if it <b>disagrees</b>, the text may be sarcastic or ambiguous.</> },
    coverage: { title: "Concept coverage", body: <>The <b>estimated share of your text that SenticNet recognises</b>. Above the threshold, SenticNet is used. Below it, the tool <b>falls back to VADER</b>. It also tells you if the SenticNet package is missing on the backend.</> },
};
const PANEL_COLUMN: CSSProperties = { display: "flex", flexDirection: "column" };
function HowToRead({ children, style }: {
    children: ReactNode;
    style?: CSSProperties;
}) {
    return <p className="how-to-read" style={style}><span>HOW TO READ</span><span>{children}</span></p>;
}
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
const tone = (value: number) => (value > 0.05 ? "pos" : value < -0.05 ? "neg" : "neu");
function LiveInner() {
    const phone = useMediaQuery("(max-width: 620px)");
    const { runId } = useActiveRun();
    const detectedSubreddits = useDetectedSubreddits(runId);
    const [filters, setFilters] = useState<AnalysisFilterState>(DEFAULT_FILTERS);
    const [text, setText] = useState(EXAMPLES[0]);
    const [result, setResult] = useState<LiveResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tourOpen, setTourOpen] = useState(false);
    const [glossaryOpen, setGlossaryOpen] = useState(false);
    useEffect(() => {
        const trimmed = text.trim();
        if (!trimmed) {
            setResult(null);
            setError(null);
            setLoading(false);
            return;
        }
        const controller = new AbortController();
        setLoading(true);
        const timer = window.setTimeout(() => {
            analyseLive(trimmed, controller.signal)
                .then((data) => {
                setResult(data);
                setError(null);
            })
                .catch((err: unknown) => {
                if (err instanceof DOMException && err.name === "AbortError")
                    return;
                setError(err instanceof Error ? err.message : "Could not analyse that text.");
            })
                .finally(() => {
                if (!controller.signal.aborted)
                    setLoading(false);
            });
        }, DEBOUNCE_MS);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [text]);
    const radarData = result
        ? [
            { dimension: "Pleasantness", value: result.hourglass.pleasantness },
            { dimension: "Attention", value: result.hourglass.attention },
            { dimension: "Sensitivity", value: result.hourglass.sensitivity },
            { dimension: "Aptitude", value: result.hourglass.aptitude },
        ]
        : [];
    const scores: {
        label: string;
        value: number | null | undefined;
        info: InfoContent;
    }[] = [
        { label: "SENTICNET", value: result?.senticnet, info: INFO.senticnet },
        { label: "VADER", value: result?.vader, info: INFO.vader },
        { label: "TEXTBLOB", value: result?.textblob, info: INFO.textblob },
    ];
    return (<main className="pulse-app">
      <DashboardSidebar active="Live Analyser" runId={runId}/>
      <div className="dashboard-shell">
        <div className="topbar">
          <span>
            <i className="live-dot"/> live build
          </span>
          <span>
            Group MDS05 <b>|</b> Supervisor: G. Krishnasamy
          </span>
        </div>
        <main className="dashboard-content">
          <p className="eyebrow">08 · LIVE ANALYSER</p>
          <h1>Paste any sentence — get a SenticNet read in real time</h1>
          <p className="intro">
            A live mirror of the pipeline. Polarity, all four Hourglass dimensions, and
            side-by-side baselines, scored by the same backend the batch pipeline uses.
          </p>

          <div className="pulse-toolbar">
            <button type="button" className="tour-trigger" onClick={() => setTourOpen(true)}>▶ TAKE THE 60-SECOND TOUR</button>
            <button type="button" className="glossary-trigger" onClick={() => setGlossaryOpen(true)}>📖 GLOSSARY</button>
          </div>
          {tourOpen && <PulseTour steps={LIVE_TOUR_STEPS} onClose={() => setTourOpen(false)}/>}
          {glossaryOpen && <GlossaryModal items={LIVE_GLOSSARY} onClose={() => setGlossaryOpen(false)}/>}

          <AnalysisFilters filters={filters} onChange={setFilters} defaults={DEFAULT_FILTERS} subredditOptions={detectedSubreddits} conflictOptions={conflicts}/>

          <div className="live-grid">
            <section className="panel" data-tour="live-input" style={PANEL_COLUMN}>
              <div className="panel-heading">
                <div>
                  <h2>Input</h2>
                  <p>English, free-form. Try a Reddit comment, a news quote, or your own writing.</p>
                </div>
                <InfoTip title={INFO.input.title}>{INFO.input.body}</InfoTip>
              </div>
              <div className="live-input-body">
                <textarea className="live-textarea" value={text} onChange={(event) => setText(event.target.value)} maxLength={2000} placeholder="Type or paste text here…" aria-label="Text to analyse"/>
                <div className="live-actions">
                  {EXAMPLES.map((example, index) => (<button key={index} type="button" className="live-chip" onClick={() => setText(example)}>
                      Example {index + 1}
                    </button>))}
                  <button type="button" className="live-clear" onClick={() => setText("")}>
                    Clear
                  </button>
                </div>
                <span className="live-count">{text.length}/2000</span>
              </div>
              <HowToRead style={{ marginTop: "auto" }}>
                <b>Type or paste</b> a sentence and the <b>Score panel updates by itself</b> a moment later. Use <b>Example 1, 2, 3</b> to see how a hopeful, an angry and a balanced sentence are read, then <b>edit them</b> to see what changes. The counter shows how much of the <b>2,000-character limit</b> you have used.
              </HowToRead>
            </section>

            <section className="panel" style={PANEL_COLUMN}>
              <div className="panel-heading">
                <div>
                  <h2>Score</h2>
                  <p>SenticNet 9 + exploratory Hourglass + baselines{loading ? " · scoring…" : ""}</p>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
                  {result && <span className={`live-label live-label-${result.label}`}>{result.label}</span>}
                  <InfoTip title={INFO.score.title}>{INFO.score.body}</InfoTip>
                </div>
              </div>

              <div className="live-score-body">
                <div className="live-score-cards" data-tour="live-scores">
                  {scores.map((score) => (<div className="live-score-card" key={score.label}>
                      <span>{score.label}<InfoTip title={score.info.title}>{score.info.body}</InfoTip></span>
                      <strong className={score.value === undefined || score.value === null ? "neu" : tone(score.value)}>
                        {score.value === undefined || score.value === null ? "—" : signed(score.value)}
                      </strong>
                    </div>))}
                </div>

                <div data-tour="live-radar">
                {error ? (<div className="live-empty live-error" role="alert">
                    {error}
                  </div>) : result ? (<div className="live-radar">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData} outerRadius={phone ? "52%" : "68%"}>
                        <PolarGrid stroke="#202931"/>
                        <PolarAngleAxis dataKey="dimension" tick={{ fill: "#c0c6ca", fontSize: 12 }}/>
                        <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false}/>
                        <Radar dataKey="value" stroke="#efa92b" fill="#efa92b" fillOpacity={0.28} strokeWidth={2} isAnimationActive={false}/>
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>) : (<div className="live-empty">Type or paste some text to see its score.</div>)}
                </div>

                <div className="live-footnote" data-tour="live-coverage">
                  <InfoTip title={INFO.coverage.title}>{INFO.coverage.body}</InfoTip>{" "}
                  {result ? (<>
                      Concept coverage estimate: <b>{result.coverage_pct}%</b>
                      {result.fell_back_to_vader
                ? ` · fell back to VADER below ${result.coverage_threshold_pct}%.`
                : ` · above the ${result.coverage_threshold_pct}% threshold, using SenticNet.`}
                      {!result.senticnet_available && " SenticNet package not installed on the backend."}
                    </>) : (<>Concept coverage estimate: — · falls back to VADER below 60%.</>)}
                </div>
              </div>
              <HowToRead style={{ marginTop: "auto" }}>
                Each <b>score</b> runs from <b>-1 (very negative)</b> to <b>+1 (very positive)</b>: <b>green</b> = positive, <b>red</b> = negative, <b>grey</b> = neutral. When <b>all three agree</b>, trust the result; when they <b>disagree</b>, the text may be sarcastic or mixed. On the <b>radar</b>, the further the shape reaches toward a corner, the <b>stronger that emotion</b> is in your text. The <b>note at the bottom</b> tells you whether SenticNet or the VADER fallback produced the main score.
              </HowToRead>
            </section>
          </div>
        </main>
      </div>
    </main>);
}
export default function LiveRoute() {
    return (<Suspense fallback={null}>
      <LiveInner />
    </Suspense>);
}
