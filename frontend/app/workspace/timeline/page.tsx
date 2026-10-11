"use client";
import { Suspense, useMemo, useState, type ReactNode } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import DashboardSidebar from "@/components/DashboardSidebar";
import AnalysisFilters from "@/components/AnalysisFilters";
import InfoTip, { type InfoContent } from "@/components/InfoTip";
import PulseTour, { type TourStep } from "@/components/PulseTour";
import GlossaryModal, { type GlossaryItem } from "@/components/GlossaryModal";
import { getResults } from "@/lib/api";
import { dailySeries, detectScale, scaleKey, scaleText, useRunData, whenLabel, type DailyPoint } from "@/lib/analysisData";
import { useActiveRun } from "@/lib/useActiveRun";
import NoAnalysisSelected from "@/components/NoAnalysisSelected";
type TimelineEvent = {
    key: string;
    date: string;
    x: string;
    when: string;
    title: string;
    text: string;
    conflict: string;
    polarity: number;
    tone: "negative" | "positive";
    subreddit?: string;
    emotion?: string;
    upvotes?: number | null;
    vader: number;
};
const MAX_EVENTS = 25;
const TIMELINE_TOUR_STEPS: TourStep[] = [
    { target: "timeline-chart", title: "Volume × polarity", body: "Blue bars show how many comments were posted in each period. The gold line shows the average mood. Dashed vertical markers flag the strongest-signal comments." },
    { target: "timeline-events", title: "Annotated events", body: "The standout comments behind those markers, listed in time order. A red dot is negative, a green dot is positive. Click a row to select it." },
    { target: "timeline-detail", title: "Event drill-down", body: "The full text and scores of the selected comment, compared with the volume and mood of that day. Use the button to open the source records." },
];
const TIMELINE_GLOSSARY: GlossaryItem[] = [
    { term: "Timeline", plain: "Your comments arranged in time order.", detail: "It shows how the conversation changed, not just where it ended up." },
    { term: "Volume", plain: "How many comments were posted in a period.", detail: "Shown as blue bars on the left axis. Tall bars mean a busy moment." },
    { term: "Polarity", plain: "How positive or negative a comment is.", detail: "A score from -1 (very negative) to +1 (very positive). Around 0 is neutral." },
    { term: "Rolling polarity", plain: "The average mood, smoothed over a few periods.", detail: "Shown as the gold line on the right axis. Smoothing stops one odd comment from dominating." },
    { term: "Dual axis", plain: "One chart with two scales.", detail: "The left axis counts comments (bars). The right axis is polarity (line). Read each against its own axis." },
    { term: "Time bucket", plain: "A short slice of the day.", detail: "If all your data is from one date, the x-axis switches from days to time-of-day buckets." },
    { term: "Event marker", plain: "A dashed vertical line on the chart.", detail: "Marks the day or time of a strongest-signal comment. Red is negative, green is positive, gold is the one selected." },
    { term: "Annotated event", plain: "A comment with an unusually strong tone.", detail: "The slice's strongest comments, ranked by how far their polarity is from zero." },
    { term: "Drill-down", plain: "Zooming in on a single comment.", detail: "Shows its text, polarity, VADER score, emotion, upvotes and how its day compared." },
    { term: "VADER", plain: "A ready-made scorer for short, informal text.", detail: "Shown beside polarity as a second opinion on the comment's tone." },
    { term: "Slice", plain: "The part of the data you are looking at right now.", detail: "Filters for conflict, subreddit, dates or keywords change the slice, and every chart updates." },
];
const INFO: Record<"volumePolarity" | "annotatedEvents" | "eventDrilldown", InfoContent> = {
    volumePolarity: { title: "Volume × polarity", body: <>Two measures on one chart. <b>Bars</b> (left axis) count the comments in each period. The <b>line</b> (right axis) is the average mood, smoothed over a few periods; below zero means negative. Dashed <b>vertical markers</b> flag the strongest-signal comments, and clicking one selects it.</> },
    annotatedEvents: { title: "Annotated events", body: <>The <b>strongest-signal comments</b> in the current slice (up to 25), ranked by how far their polarity is from zero and listed in time order. Each row shows the date, conflict, a preview and the comment&rsquo;s polarity.</> },
    eventDrilldown: { title: "Event drill-down", body: <>The <b>full detail of the selected comment</b>: its text, polarity, VADER score, emotion and upvotes when available, plus the volume and rolling polarity of the day (or time bucket) it was posted in.</> },
};
function TimelineInner() {
    const { runId, resolving } = useActiveRun();
    const { summary, records, filtered, filters, setFilters, defaults, conflictOptions, subredditOptions, loading, error } = useRunData(runId, getResults);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [tourOpen, setTourOpen] = useState(false);
    const [glossaryOpen, setGlossaryOpen] = useState(false);
    const sampleScale = summary && summary.records_after_dedup > records.length ? summary.records_after_dedup / records.length : 1;
    const scale = useMemo(() => detectScale(filtered), [filtered]);
    const scaleLabels = scaleText(scale);
    const dailySeriesData = useMemo(() => dailySeries(filtered, 3, scale).map((point) => ({ ...point, volume: Math.round(point.volume * sampleScale) })), [filtered, sampleScale, scale]);
    const events = useMemo<TimelineEvent[]>(() => {
        const dated = filtered.filter((record) => !!scaleKey(record, scale));
        return dated
            .map((record, index) => ({ record, index }))
            .sort((a, b) => Math.abs(b.record.source_polarity) - Math.abs(a.record.source_polarity) || (b.record.upvotes ?? 0) - (a.record.upvotes ?? 0))
            .slice(0, MAX_EVENTS)
            .map(({ record, index }) => ({
            key: `${record.event_date}-${index}`,
            date: record.event_date as string,
            x: scaleKey(record, scale) as string,
            when: whenLabel(record),
            title: record.text.length > 56 ? `${record.text.slice(0, 56)}...` : record.text,
            text: record.text,
            conflict: record.conflict ?? "Unclassified",
            polarity: record.source_polarity,
            tone: (record.source_polarity >= 0 ? "positive" : "negative") as TimelineEvent["tone"],
            subreddit: record.subreddit ?? undefined,
            emotion: record.emotion ?? undefined,
            upvotes: record.upvotes,
            vader: record.vader_score,
        }))
            .sort((a, b) => a.when.localeCompare(b.when));
    }, [filtered, scale]);
    const selected = events.find((event) => event.key === selectedKey) ?? events[0] ?? null;
    const selectedDay = selected ? dailySeriesData.find((point) => point.date === selected.x) : undefined;
    const undated = filtered.filter((record) => !scaleKey(record, scale)).length;
    return (<main className="pulse-app timeline-app">
      <DashboardSidebar active="Timeline" runId={runId}/>
      <div className="dashboard-shell">
        <div className="topbar"><span><i className="live-dot"/> live build</span><span>Group MDS05 <b>|</b> Supervisor: Ganesh Krishnasamy</span></div>
        <main className="dashboard-content timeline-content">
          <p className="eyebrow">02 · TIMELINE</p>
          <h1>Sentiment over time in your uploaded data</h1>
          <p className="timeline-intro">{scale.kind === "time" ? `Your data covers a single date (${scale.date}), so the x-axis shows time of day in ${scale.bucketMinutes}-minute buckets.` : "Your data spans several dates, so the x-axis shows dates."} Dual-axis: comment volume (bars) and {scaleLabels.rolling} polarity (line), both computed from the comments in your file. Vertical markers are the strongest-signal comments in the slice — click any one to inspect.</p>

          <div className="pulse-toolbar">
            <button type="button" className="tour-trigger" onClick={() => setTourOpen(true)}>▶ TAKE THE 60-SECOND TOUR</button>
            <button type="button" className="glossary-trigger" onClick={() => setGlossaryOpen(true)}>📖 GLOSSARY</button>
          </div>
          {tourOpen && <PulseTour steps={TIMELINE_TOUR_STEPS} onClose={() => setTourOpen(false)}/>}
          {glossaryOpen && <GlossaryModal items={TIMELINE_GLOSSARY} onClose={() => setGlossaryOpen(false)}/>}

          <AnalysisFilters filters={filters} onChange={setFilters} defaults={defaults} subredditOptions={subredditOptions} conflictOptions={conflictOptions}/>

          {resolving || loading ? <div className="timeline-chart-empty">Loading your data…</div> : !runId ? <NoAnalysisSelected /> : error ? <div className="timeline-chart-empty">{error}</div> : !records.length ? <div className="timeline-chart-empty">This analysis has no scored comments.</div> : <>
          <section className="timeline-panel chart-panel" data-tour="timeline-chart"><div className="timeline-panel-heading"><div><h2>Volume × polarity</h2><p>{dailySeriesData.length ? "Click an event marker to drill in →" : "This file has no usable date column, so no time series can be drawn."}{undated > 0 && dailySeriesData.length > 0 ? ` ${undated.toLocaleString()} comments without a usable date/time are not plotted.` : ""}{sampleScale > 1 ? ` Volumes are estimated from an evenly spaced sample of ${records.length.toLocaleString()} of ${summary?.records_after_dedup.toLocaleString()} unique records.` : ""}</p></div><InfoTip title={INFO.volumePolarity.title}>{INFO.volumePolarity.body}</InfoTip></div><VolumePolarityChart data={dailySeriesData} events={events} selected={selected} onSelect={(event) => setSelectedKey(event.key)} timeOfDay={scale.kind === "time"}/><HowToRead>The <b>blue bars</b> (left axis) are how many comments were posted. The <b>gold line</b> (right axis) is the average mood; <b>below zero = negative</b>. Dashed markers are the strongest comments: <b>red</b> = negative, <b>green</b> = positive, <b>gold</b> = selected. Click one to inspect it.</HowToRead></section>
          <div className="timeline-bottom-grid">
            <section className="timeline-panel event-index" data-tour="timeline-events"><div className="timeline-panel-heading"><div><h2>Annotated events</h2><p>{events.length} events in window</p></div><InfoTip title={INFO.annotatedEvents.title}>{INFO.annotatedEvents.body}</InfoTip></div><div className="event-index-list">{events.map((event) => <button type="button" key={event.key} className={`event-index-row${selected?.key === event.key ? " is-selected" : ""}`} onClick={() => setSelectedKey(event.key)}><span>{scale.kind === "time" ? event.when.slice(11) || event.date : event.date}</span><i className={event.tone}/><div><small>{event.conflict}</small><strong>{event.title}</strong></div><b>{event.polarity.toFixed(2)}</b></button>)}{!events.length && <p className="empty-state">No dated comments match the current filters.</p>}</div><HowToRead>Each row is one standout comment, in time order. <b>Green dot</b> = positive, <b>red dot</b> = negative; the number on the right is its polarity (-1 to +1). Click a row to see it in the drill-down and highlight it on the chart.</HowToRead></section>
            <section className="timeline-panel event-detail" data-tour="timeline-detail"><div className="timeline-panel-heading"><div><h2>Event drill-down</h2><p>Select an event from the list or the chart</p></div><InfoTip title={INFO.eventDrilldown.title}>{INFO.eventDrilldown.body}</InfoTip></div>{selected ? <div className="event-detail-body"><span className="detail-kicker">{selected.when} · {selected.conflict}{selected.subreddit ? ` · ${selected.subreddit}` : ""}</span><h3>{selected.text.length > 220 ? `${selected.text.slice(0, 220)}...` : selected.text}</h3><div className="detail-score"><span>COMMENT POLARITY</span><strong className={selected.polarity < 0 ? "is-negative" : ""}>{selected.polarity >= 0 ? "+" : ""}{selected.polarity.toFixed(2)}</strong></div><p>VADER {selected.vader.toFixed(2)}{selected.emotion ? ` · emotion: ${selected.emotion}` : ""}{selected.upvotes !== null && selected.upvotes !== undefined ? ` · ${selected.upvotes.toLocaleString()} upvotes` : ""}{selectedDay ? ` · that ${scale.kind === "time" ? "time bucket" : "day"}: ${selectedDay.volume.toLocaleString()} comments, ${scaleLabels.rolling} polarity ${selectedDay.polarity.toFixed(3)}` : ""}.</p><a className="detail-button" href={runId ? `/workspace/explorer?run=${encodeURIComponent(runId)}` : "/workspace/explorer"}>OPEN SOURCE RECORDS →</a></div> : <div className="event-detail-body"><p>No event selected.</p></div>}<HowToRead>The <b>big number</b> is this comment&rsquo;s polarity. Compare it with the polarity of its day at the bottom of the text: a comment far from its day&rsquo;s average is an <b>outlier</b>. Use <b>OPEN SOURCE RECORDS</b> to read it in context.</HowToRead></section>
          </div>
          </>}
        </main>
      </div>
    </main>);
}
function HowToRead({ children }: {
    children: ReactNode;
}) { return <p className="how-to-read"><span>HOW TO READ</span><span>{children}</span></p>; }
function VolumePolarityChart({ data, events, selected, onSelect, timeOfDay }: {
    data: DailyPoint[];
    events: TimelineEvent[];
    selected: TimelineEvent | null;
    onSelect: (event: TimelineEvent) => void;
    timeOfDay?: boolean;
}) {
    if (!data.length)
        return <div className="timeline-chart-empty">Not enough dated records to chart a trend yet.</div>;
    const eventDates = new Set(data.map((point) => point.date));
    return (<div className="timeline-chart-recharts">
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 12, right: 20, left: 4, bottom: 4 }}>
          <CartesianGrid stroke="#2a343c" strokeDasharray="2 4" vertical={false}/>
          <XAxis dataKey="date" tick={{ fill: "#68727a", fontSize: 9, fontFamily: "JetBrains Mono, monospace" }} axisLine={{ stroke: "#2a343c" }} tickLine={false} minTickGap={timeOfDay ? 32 : 50}/>
          <YAxis yAxisId="volume" tick={{ fill: "#68727a", fontSize: 9, fontFamily: "JetBrains Mono, monospace" }} axisLine={false} tickLine={false} width={42}/>
          <YAxis yAxisId="polarity" orientation="right" domain={["dataMin - 0.1", "dataMax + 0.1"]} tickFormatter={(value: number) => value.toFixed(2)} tick={{ fill: "#68727a", fontSize: 9, fontFamily: "JetBrains Mono, monospace" }} axisLine={false} tickLine={false} width={44}/>
          <Tooltip content={<VolumePolarityTooltip />} cursor={{ stroke: "#e7e9eb", strokeWidth: 1 }}/>
          <Bar yAxisId="volume" dataKey="volume" name="Comment volume" fill="#008fac" fillOpacity={0.78} radius={[2, 2, 0, 0]}/>
          <Line yAxisId="polarity" type="monotone" dataKey="polarity" name="Rolling polarity" stroke="#f0ae2a" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#f0ae2a", stroke: "#0b0f14", strokeWidth: 2 }}/>
          {events
            .filter((event) => eventDates.has(event.x))
            .map((event) => (<ReferenceLine key={event.key} x={event.x} yAxisId="polarity" stroke={event.key === selected?.key ? "#f0ae2a" : event.tone === "positive" ? "#42a27d" : "#d74949"} strokeWidth={event.key === selected?.key ? 2 : 1.2} strokeDasharray="3 4" strokeOpacity={event.key === selected?.key ? 1 : 0.72} onClick={() => onSelect(event)} style={{ cursor: "pointer" }}/>))}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="timeline-legend"><span><i className="legend-volume"/> Comment volume</span><span><i className="legend-polarity"/> Rolling polarity</span></div>
    </div>);
}
function VolumePolarityTooltip({ active, payload, label }: {
    active?: boolean;
    payload?: {
        dataKey?: string;
        value: number;
    }[];
    label?: string;
}) {
    if (!active || !payload?.length)
        return null;
    const volume = payload.find((item) => item.dataKey === "volume")?.value;
    const polarity = payload.find((item) => item.dataKey === "polarity")?.value;
    return (<div className="chart-tooltip">
      <span className="chart-tooltip-date">{label}</span>
      {volume !== undefined && <span className="chart-tooltip-value">volume : {volume}</span>}
      {polarity !== undefined && <span className="chart-tooltip-value">polarity : {polarity.toFixed(3)}</span>}
    </div>);
}
export default function TimelineRoute() { return <Suspense fallback={null}><TimelineInner /></Suspense>; }
