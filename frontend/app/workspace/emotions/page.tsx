"use client";
import { Suspense, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useActiveRun } from "@/lib/useActiveRun";
import NoAnalysisSelected from "@/components/NoAnalysisSelected";
import { getResults } from "@/lib/api";
import { CONFLICT_PALETTE, DIMENSION_COLORS, DIMENSION_KEYS, DIMENSION_LABELS, dailySeries, detectScale, scaleText, emotionShares, filterRecords, topConcepts, useRunData, } from "@/lib/analysisData";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, } from "recharts";
import DashboardSidebar from "@/components/DashboardSidebar";
import AnalysisFilters from "@/components/AnalysisFilters";
import InfoTip, { type InfoContent } from "@/components/InfoTip";
import PulseTour, { type TourStep } from "@/components/PulseTour";
import GlossaryModal, { type GlossaryItem } from "@/components/GlossaryModal";
import { useMediaQuery } from "@/lib/useMediaQuery";
const EMOTIONS_TOUR_STEPS: TourStep[] = [
    { target: "emotions-radar", title: "Hourglass radar", body: "Each corner is one of the four emotion dimensions. The further a shape stretches toward a corner, the larger the share of comments dominated by that emotion. Pick two conflicts in the filters to compare their shapes side by side." },
    { target: "emotions-stream", title: "Emotion stream", body: "The same four dimensions over time. Each coloured band is one dimension and the bands always stack to 100%, so a widening band means that emotion is taking over the conversation." },
    { target: "emotions-cloud", title: "Concept word cloud", body: "The most-used words in your comments. Bigger words appear in more comments; the colour shows which emotion dimension most often goes with that word." },
];
const EMOTIONS_GLOSSARY: GlossaryItem[] = [
    { term: "Hourglass of Emotions", plain: "An exploratory model with four dimensions.", detail: "Instead of just good vs bad, each comment is assigned a SenticNet-derived dimension. These labels are not human-validated in this build." },
    { term: "Pleasantness", plain: "Joy vs sadness.", detail: "Is the person happy or upset?" },
    { term: "Attention", plain: "Interest vs surprise or boredom.", detail: "How engaged or alert the person sounds." },
    { term: "Sensitivity", plain: "Fear and anger.", detail: "How emotionally reactive the comment is. High sensitivity often means distress." },
    { term: "Aptitude", plain: "Trust vs disgust.", detail: "How much the person accepts or rejects what they are talking about." },
    { term: "Dominant emotion", plain: "The one dimension that best describes a comment.", detail: "Every comment counts toward exactly one dimension, so the shares always add up to 100%." },
    { term: "Share", plain: "The percentage of comments that fall into a dimension.", detail: "A 40% Sensitivity share means four in ten comments are mainly fear or anger." },
    { term: "Radar chart", plain: "A web-shaped chart with one axis per dimension.", detail: "The further a shape reaches along an axis, the bigger that dimension's share. Shapes are easy to compare at a glance." },
    { term: "Conflict", plain: "The topic a comment belongs to, such as Israel-Gaza or US-Iran.", detail: "When you select conflicts, each one gets its own coloured shape on the radar." },
    { term: "Emotion stream", plain: "A stacked area chart of the four dimensions over time.", detail: "Each band is one dimension. Together the bands fill the chart to 100%, so you see the mix shifting rather than raw counts." },
    { term: "Stacked area", plain: "Bands piled on top of each other.", detail: "Read a band's thickness, not its height on the axis, to see how big that dimension is." },
    { term: "Time bucket", plain: "A short slice of the day.", detail: "If all your data is from one date, the stream switches from days to time-of-day buckets." },
    { term: "Concept word cloud", plain: "The most frequent words in your comments.", detail: "Short words and everyday filler words are ignored. A word is counted once per comment, however often it repeats." },
    { term: "Word colour", plain: "The emotion dimension most often linked to that word.", detail: "It comes from the comments the word appears in, so it shows the mood around a word, not the word's dictionary meaning." },
    { term: "Slice", plain: "The part of the data you are looking at right now.", detail: "Filters for conflict, subreddit, dates or keywords change the slice, and every chart updates." },
];
const INFO: Record<"radar" | "stream" | "cloud", InfoContent> = {
    radar: { title: "Hourglass radar", body: <>Shows the <b>share of comments</b> whose dominant emotion is each of the four Hourglass dimensions. With no conflict selected it covers all comments in the slice; with conflicts selected, <b>each conflict gets its own coloured shape</b> so you can compare them. The count in brackets is how many comments each shape is based on.</> },
    stream: { title: "Emotion stream", body: <>The same four dimensions <b>over time</b>. Each period shows the share of comments in each dimension, stacked so the bands always fill 100%. If your data covers a single date, the horizontal axis switches to <b>time-of-day buckets</b> instead of days.</> },
    cloud: { title: "Concept word cloud", body: <>The <b>most frequent words</b> in the comments of the current slice (short and filler words removed). <b>Size</b> = how many comments use the word. <b>Colour</b> = the emotion dimension most often found in those comments. Hover a word to see its exact count.</> },
};
function EmotionsInner() {
    const phone = useMediaQuery("(max-width: 620px)");
    const { runId, resolving } = useActiveRun();
    const { records, filtered, filters, setFilters, defaults, conflictOptions, subredditOptions, loading, error } = useRunData(runId, getResults);
    const [tourOpen, setTourOpen] = useState(false);
    const [glossaryOpen, setGlossaryOpen] = useState(false);
    const conflictColor = (name: string) => CONFLICT_PALETTE[Math.max(0, conflictOptions.indexOf(name)) % CONFLICT_PALETTE.length];
    const activeConflicts = filters.selectedConflicts.filter((name) => conflictOptions.includes(name));
    const conflictShares = useMemo(() => activeConflicts.map((name) => {
        const rows = filterRecords(records, filters, { conflict: true }).filter((record) => record.conflict === name);
        return { name, n: rows.length, shares: emotionShares(rows) };
    }), [records, filters, activeConflicts.join("|")]);
    const overallShares = useMemo(() => emotionShares(filtered), [filtered]);
    const radarSeries = conflictShares.length ? conflictShares.map((item) => ({ key: item.name, color: conflictColor(item.name), shares: item.shares, n: item.n })) : [{ key: "All comments", color: CONFLICT_PALETTE[0], shares: overallShares, n: filtered.length }];
    const radarData = DIMENSION_KEYS.map((dim) => {
        const row: Record<string, string | number> = { dimension: DIMENSION_LABELS[dim] };
        for (const series of radarSeries)
            row[series.key] = series.shares[dim];
        return row;
    });
    const radarMax = Math.max(0.25, ...radarSeries.flatMap((series) => DIMENSION_KEYS.map((dim) => series.shares[dim])));
    const scale = useMemo(() => detectScale(filtered), [filtered]);
    const streamData = useMemo(() => dailySeries(filtered, 3, scale).map((point) => ({ date: point.date, Pleasantness: point.pleasantness, Attention: point.attention, Sensitivity: point.sensitivity, Aptitude: point.aptitude })), [filtered, scale]);
    const scaleLabels = scaleText(scale);
    const wordCloud = useMemo(() => {
        const words = topConcepts(filtered, 36);
        const max = Math.max(1, ...words.map((word) => word.count));
        const min = Math.min(...words.map((word) => word.count), max);
        return words.map((word) => ({ ...word, size: 14 + Math.round(((word.count - min) / Math.max(1, max - min)) * 34) }));
    }, [filtered]);
    const state = resolving || loading ? "Loading your data…" : !runId ? "No analysis selected. Start one from the Pulse page." : error ? error : !records.length ? "This analysis has no scored comments." : !filtered.length ? "No comments match the current filters." : null;
    return (<main className="pulse-app">
      <DashboardSidebar active="Emotions" runId={runId}/>
      <div className="dashboard-shell">
        <div className="topbar">
          <span>
            <i className="live-dot"/> live build
          </span>
          <span>
            Group MDS05 <b>|</b> Supervisor: Ganesh Krishnasamy
          </span>
        </div>
        <main className="dashboard-content">
          <p className="eyebrow">03 · EMOTIONS</p>
          <h1>The four dimensions of public reaction</h1>
          <p className="intro">
            Each comment in your file is exploratorily mapped onto the Hourglass of Emotions: Pleasantness,
            Attention, Sensitivity, Aptitude from the comment text. These dimensions are not validated against human emotion labels in this build;
            treat them as exploratory indicators, not ground truth. Compare conflicts side by side, then watch how each dimension evolves over time.
          </p>

          <div className="pulse-toolbar">
            <button type="button" className="tour-trigger" onClick={() => setTourOpen(true)}>▶ TAKE THE 60-SECOND TOUR</button>
            <button type="button" className="glossary-trigger" onClick={() => setGlossaryOpen(true)}>📖 GLOSSARY</button>
          </div>
          {tourOpen && <PulseTour steps={EMOTIONS_TOUR_STEPS} onClose={() => setTourOpen(false)}/>}
          {glossaryOpen && <GlossaryModal items={EMOTIONS_GLOSSARY} onClose={() => setGlossaryOpen(false)}/>}

          <AnalysisFilters filters={filters} onChange={setFilters} defaults={defaults} subredditOptions={subredditOptions} conflictOptions={conflictOptions}/>

          {state ? (!runId && !resolving && !loading ? <NoAnalysisSelected /> : <div className="timeline-chart-empty">{state}</div>) : (<>
          <div className="two-col-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 11 }}>
            <section className="panel" data-tour="emotions-radar" style={PANEL_COLUMN}>
              <div className="panel-heading">
                <div>
                  <h2>Hourglass radar</h2>
                  <p>{conflictShares.length ? "Share of each conflict's comments per dimension" : "Share of all comments per dimension"}</p>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
                  <div className="legend">
                    {radarSeries.map((series) => (<span key={series.key} style={{ marginRight: 10 }}>
                        <i style={{ background: series.color }}/>
                        {series.key} ({series.n.toLocaleString()})
                      </span>))}
                  </div>
                  <InfoTip title={INFO.radar.title}>{INFO.radar.body}</InfoTip>
                </div>
              </div>
              <div style={{ height: 340, padding: "10px 8px 4px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} outerRadius={phone ? "54%" : "72%"}>
                    <PolarGrid stroke="#202931"/>
                    <PolarAngleAxis dataKey="dimension" tick={{ fill: "#8b949c", fontSize: 11 }}/>
                    <PolarRadiusAxis domain={[0, Math.ceil(radarMax * 10) / 10]} tickFormatter={(value: number) => `${Math.round(value * 100)}%`} tick={{ fill: "#66717a", fontSize: 9 }} stroke="#202931"/>
                    {radarSeries.map((series) => (<Radar key={series.key} name={series.key} dataKey={series.key} stroke={series.color} fill={series.color} fillOpacity={0.22} strokeWidth={2}/>))}
                    <Tooltip content={<HourglassTooltip percent/>}/>
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <HowToRead style={{ marginTop: "auto" }}>
                Each <b>corner</b> is one emotion dimension. The <b>further a shape reaches toward a corner</b>, the bigger that dimension&rsquo;s share of comments (the rings show %). A <b>lopsided shape</b> means one emotion dominates; a <b>rounder shape</b> means a balanced mix. With several conflicts selected, <b>compare the coloured shapes</b> to see how their reactions differ.
              </HowToRead>
            </section>

            <section className="panel" data-tour="emotions-stream" style={PANEL_COLUMN}>
              <div className="panel-heading">
                <div>
                  <h2>Emotion stream</h2>
                  <p>{streamData.length ? `Stacked area over time — ${scaleLabels.per} share of comments per dimension${scale.kind === "time" ? ` · ${scale.date}, by time of day` : ""}` : "No dated comments, so no stream can be drawn"}</p>
                </div>
                <InfoTip title={INFO.stream.title}>{INFO.stream.body}</InfoTip>
              </div>
              <div style={{ height: 340, padding: "10px 8px 4px" }}>
                {streamData.length ? (<ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={streamData}>
                    <CartesianGrid stroke="#202931" strokeDasharray="2 4" vertical={false}/>
                    <XAxis dataKey="date" tick={{ fill: "#66717a", fontSize: 9 }} tickLine={false} minTickGap={scale.kind === "time" ? 36 : 60}/>
                    <YAxis domain={[0, 1]} tickFormatter={(value: number) => `${Math.round(value * 100)}%`} tick={{ fill: "#66717a", fontSize: 9 }} tickLine={false}/>
                    <Tooltip content={<HourglassTooltip percent/>}/>
                    <Legend wrapperStyle={{ fontSize: 9, color: "#78838c", fontFamily: "'JetBrains Mono', monospace" }}/>
                    {DIMENSION_KEYS.map((dim) => (<Area key={dim} type="monotone" dataKey={DIMENSION_LABELS[dim]} stackId="1" stroke={DIMENSION_COLORS[dim]} fill={DIMENSION_COLORS[dim]} fillOpacity={0.32}/>))}
                  </AreaChart>
                </ResponsiveContainer>) : <div className="timeline-chart-empty">This file has no usable date column.</div>}
              </div>
              <HowToRead style={{ marginTop: "auto" }}>
                The <b>horizontal axis is time</b> ({scale.kind === "time" ? "time of day" : "dates"}); the <b>vertical axis is 100% of comments</b>. Each <b>coloured band</b> is one dimension, and <b>a thicker band = a bigger share</b> in that period. Watch for a band that <b>widens or shrinks</b>: that is the mood of the conversation shifting. Hover the chart to read exact percentages.
              </HowToRead>
            </section>
          </div>

          <section className="panel" data-tour="emotions-cloud" style={{ marginTop: 9 }}>
            <div className="panel-heading">
              <div>
                <h2>Concept word cloud</h2>
                <p>Most frequent words in your comments, sized by number of comments using them, coloured by their dominant emotion</p>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
                <div className="legend">
                  {DIMENSION_KEYS.map((dim) => (<span key={dim} style={{ marginRight: 10 }}>
                      <i style={{ background: DIMENSION_COLORS[dim] }}/>
                      {DIMENSION_LABELS[dim]}
                    </span>))}
                </div>
                <InfoTip title={INFO.cloud.title}>{INFO.cloud.body}</InfoTip>
              </div>
            </div>
            <div style={{
                padding: "18px 20px 22px",
                display: "flex",
                flexWrap: "wrap",
                gap: "6px 16px",
                alignItems: "baseline",
            }}>
              {wordCloud.map((w) => (<span key={w.text} title={`${w.text}: ${w.count.toLocaleString()} comments`} style={{ fontSize: w.size, color: DIMENSION_COLORS[w.emotion], fontWeight: 600 }}>
                  {w.text}
                </span>))}
            </div>
            <HowToRead>
              <b>Bigger word</b> = used in more comments. <b>Colour</b> = the emotion dimension most often found alongside that word (see the legend above). Use it to spot <b>what people keep talking about</b> and <b>how they feel about it</b>. Hover a word to see its exact comment count.
            </HowToRead>
          </section>
          </>)}
        </main>
      </div>
    </main>);
}
const PANEL_COLUMN: CSSProperties = { display: "flex", flexDirection: "column" };
function HowToRead({ children, style }: {
    children: ReactNode;
    style?: CSSProperties;
}) {
    return <p className="how-to-read" style={style}><span>HOW TO READ</span><span>{children}</span></p>;
}
function HourglassTooltip({ active, payload, label, percent }: {
    active?: boolean;
    payload?: {
        name: string;
        value: number;
        color: string;
    }[];
    label?: string;
    percent?: boolean;
}) {
    if (!active || !payload?.length)
        return null;
    return (<div className="chart-tooltip">
      <span className="chart-tooltip-date">{label}</span>
      {payload.map((p) => (<span key={p.name} className="chart-tooltip-value" style={{ color: p.color }}>
          {p.name}: {percent ? `${(p.value * 100).toFixed(1)}%` : p.value.toFixed(3)}
        </span>))}
    </div>);
}
export default function EmotionsRoute() {
    return (<Suspense fallback={null}>
      <EmotionsInner />
    </Suspense>);
}
