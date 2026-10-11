"use client";
import { Suspense, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useActiveRun } from "@/lib/useActiveRun";
import { Bar, BarChart, Cell, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, } from "recharts";
import DashboardSidebar from "@/components/DashboardSidebar";
import AnalysisFilters from "@/components/AnalysisFilters";
import InfoTip, { type InfoContent } from "@/components/InfoTip";
import PulseTour, { type TourStep } from "@/components/PulseTour";
import GlossaryModal, { type GlossaryItem } from "@/components/GlossaryModal";
import { getResults } from "@/lib/api";
import { normSub } from "@/lib/subreddits";
import { CONFLICT_PALETTE, DIMENSION_KEYS, DIMENSION_LABELS, emotionShares, filterRecords, mean, round3, useRunData, type ScoredRecord } from "@/lib/analysisData";
import { useMediaQuery } from "@/lib/useMediaQuery";
import TrustPanel from "@/components/TrustPanel";
import NoAnalysisSelected from "@/components/NoAnalysisSelected";
const NEGATIVE = "#ef4e50";
const POSITIVE = "#35c88d";
const BLUE = "#08afd4";
const MONO = "JetBrains Mono, monospace";
const AXIS_TICK = { fill: "#68727a", fontSize: 9, fontFamily: MONO };
const LABEL_TICK = { fill: "#c5cbd0", fontSize: 11, fontFamily: MONO };
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(3)}`;
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const COMPARE_TOUR_STEPS: TourStep[] = [
    { target: "compare-polarity", title: "Polarity by subreddit", body: "One bar per community showing its average mood. Green bars lean positive, red bars lean negative, and the longer the bar the stronger the lean. The bars grow left or right from zero." },
    { target: "compare-sensitivity", title: "Sensitivity by subreddit", body: "The share of each community's comments dominated by anger or fear. A longer bar means a more emotionally charged community." },
    { target: "compare-conflicts", title: "Conflict head-to-head", body: "The selected conflicts drawn on the same emotion radar so you can see how their reactions differ. The numbers underneath give each conflict's mean polarity, and which one feels worse." },
    { target: "compare-fingerprint", title: "Subreddit fingerprint", body: "A small radar for every community: its emotional personality across the four Hourglass dimensions. Two communities with different shapes react in different ways." },
];
const COMPARE_GLOSSARY: GlossaryItem[] = [
    { term: "Subreddit", plain: "A Reddit community about a particular topic.", detail: "Each bar or fingerprint on this page is one subreddit found in your file." },
    { term: "Polarity", plain: "How positive or negative a comment is.", detail: "A score from -1 (very negative) to +1 (very positive). Around 0 is neutral." },
    { term: "Mean polarity", plain: "The average mood of all comments in a group.", detail: "Below zero means the group leans negative overall. It is shown for each subreddit and each conflict." },
    { term: "Diverging bar chart", plain: "Bars that grow left or right from a zero line.", detail: "Bars to the right are positive (green), bars to the left are negative (red)." },
    { term: "Hourglass of Emotions", plain: "An exploratory model with four dimensions.", detail: "Each comment is assigned a SenticNet-derived dimension from its text. These labels are not human-validated in this build." },
    { term: "Pleasantness", plain: "Joy vs sadness.", detail: "Is the person happy or upset?" },
    { term: "Attention", plain: "Interest vs surprise or boredom.", detail: "How engaged or alert the person sounds." },
    { term: "Sensitivity", plain: "Fear and anger.", detail: "How emotionally reactive the comment is. High sensitivity often means distress." },
    { term: "Aptitude", plain: "Trust vs disgust.", detail: "How much the person accepts or rejects what they are talking about." },
    { term: "Share", plain: "The percentage of comments that fall into a dimension.", detail: "A 40% Sensitivity share means four in ten comments in that group are mainly anger or fear." },
    { term: "Conflict", plain: "The topic a comment belongs to, such as Israel-Gaza or US-Iran.", detail: "Detected from your file's text. Selecting conflicts in the filters puts them head-to-head." },
    { term: "Head-to-head", plain: "Two or more conflicts compared on the same chart.", detail: "Overlapping coloured shapes on one radar make differences easy to spot." },
    { term: "Feels worse", plain: "The conflict with the lowest mean polarity.", detail: "Only shown when more than one conflict is selected. It compares average tone, not the severity of real events." },
    { term: "Radar chart", plain: "A web-shaped chart with one axis per dimension.", detail: "The further a shape reaches along an axis, the bigger that dimension's share." },
    { term: "Fingerprint", plain: "A community's emotional signature.", detail: "The radar shape shows which emotions dominate that subreddit. Each small radar has its own scale, so compare shapes rather than sizes." },
    { term: "Records", plain: "The number of scored comments behind a figure.", detail: "Small groups give shakier results, so treat subreddits with few records with caution." },
    { term: "Slice", plain: "The part of the data you are looking at right now.", detail: "Filters for conflict, subreddit, dates or keywords change the slice, and every chart updates." },
];
const INFO: Record<"polarity" | "sensitivity" | "conflicts" | "fingerprint", InfoContent> = {
    polarity: { title: "Diverging polarity by subreddit", body: <>The <b>average mood</b> of each subreddit, from -1 (very negative) to +1 (very positive). Bars grow <b>right from zero for positive</b> communities (green) and <b>left for negative</b> ones (red), so you can see at a glance who is angrier and who is calmer.</> },
    sensitivity: { title: "Mean sensitivity by subreddit", body: <>The <b>share of each community&rsquo;s comments</b> whose dominant emotion is Sensitivity, meaning anger or fear. A longer bar means <b>more emotionally charged</b>. Hover a bar for the exact percentage and how many records it is based on.</> },
    conflicts: { title: "Conflict head-to-head", body: <>The conflicts you selected, <b>drawn on one radar</b> across the four Hourglass dimensions. The figures beneath show each conflict&rsquo;s <b>mean polarity</b> and record count. When two or more are selected, <b>FEELS WORSE</b> names the one with the lowest mean polarity.</> },
    fingerprint: { title: "Subreddit personality fingerprint", body: <>One small radar per subreddit showing the <b>share of its comments in each Hourglass dimension</b>. Think of it as the community&rsquo;s <b>emotional personality</b>. The polarity and record count sit under each name. Small communities give less reliable shapes.</> },
};
const PANEL_COLUMN: CSSProperties = { display: "flex", flexDirection: "column" };
function HowToRead({ children, style }: {
    children: ReactNode;
    style?: CSSProperties;
}) {
    return <p className="how-to-read" style={style}><span>HOW TO READ</span><span>{children}</span></p>;
}
type SubredditRow = {
    name: string;
    polarity: number;
    sensitivity: number;
    n: number;
};
type ConflictStat = {
    name: string;
    polarity: number;
    n: number;
    shares: Record<(typeof DIMENSION_KEYS)[number], number>;
};
function CompareInner() {
    const phone = useMediaQuery("(max-width: 620px)");
    const { runId, resolving } = useActiveRun();
    const { summary, records, filtered, filters, setFilters, defaults, conflictOptions, subredditOptions, loading, error } = useRunData(runId, getResults);
    const [tourOpen, setTourOpen] = useState(false);
    const [glossaryOpen, setGlossaryOpen] = useState(false);
    const detectedSubreddits = subredditOptions;
    const conflictColor = (name: string) => CONFLICT_PALETTE[Math.max(0, conflictOptions.indexOf(name)) % CONFLICT_PALETTE.length];
    const activeSubreddits = useMemo(() => (filters.selectedSubreddits.length ? detectedSubreddits.filter((name) => filters.selectedSubreddits.includes(name)) : detectedSubreddits), [detectedSubreddits, filters.selectedSubreddits]);
    const subredditRows: SubredditRow[] = useMemo(() => {
        const base = filterRecords(records, filters, { subreddit: true });
        return activeSubreddits.map((name) => {
            const rows = base.filter((record: ScoredRecord) => normSub(record.subreddit) === normSub(name));
            return {
                name,
                polarity: round3(mean(rows.map((record) => record.source_polarity))),
                sensitivity: emotionShares(rows).sensitivity,
                n: rows.length,
            };
        }).filter((row) => row.n > 0);
    }, [activeSubreddits, records, filters]);
    const conflictStats: ConflictStat[] = useMemo(() => {
        const base = filterRecords(records, filters, { conflict: true });
        return filters.selectedConflicts
            .filter((name) => conflictOptions.includes(name))
            .map((name) => {
            const rows = base.filter((record: ScoredRecord) => record.conflict === name);
            return { name, polarity: round3(mean(rows.map((record) => record.source_polarity))), n: rows.length, shares: emotionShares(rows) };
        })
            .filter((stat) => stat.n > 0);
    }, [records, filters, conflictOptions]);
    const radarData = DIMENSION_KEYS.map((dimension) => {
        const row: Record<string, string | number> = { dimension: DIMENSION_LABELS[dimension] };
        conflictStats.forEach((stat) => {
            row[stat.name] = stat.shares[dimension];
        });
        return row;
    });
    const radarMax = Math.max(0.25, ...conflictStats.flatMap((stat) => DIMENSION_KEYS.map((dimension) => stat.shares[dimension])));
    const noSubredditsMessage = !records.length ? "No data loaded." : detectedSubreddits.length ? "No subreddit has comments in the current slice." : "No subreddit column was found in this analysis, so communities can't be compared.";
    const noConflictMessage = conflictOptions.length ? "No comments about the selected conflicts in the current slice." : "No conflict could be detected in this file's text, so conflicts can't be compared.";
    const worst = conflictStats.length > 1 ? [...conflictStats].sort((a, b) => a.polarity - b.polarity)[0] : null;
    const lastRefresh = summary?.trend_dates?.length ? summary.trend_dates[summary.trend_dates.length - 1] : null;
    const truncated = !!summary && summary.records_after_dedup > records.length;
    return (<div className="pulse-app timeline-app">
      <DashboardSidebar active="Compare" runId={runId}/>
      <div className="dashboard-shell">
        <div className="topbar">
          <span>
            <i className="live-dot"/> live build
            {summary && <> · {summary.total_records.toLocaleString()} comments indexed</>}
            {lastRefresh && <> · last refresh {lastRefresh}</>}
          </span>
          <span>
            Group MDS05 <b>|</b> Supervisor: Ganesh Krishnasamy
          </span>
        </div>
        <main className="dashboard-content timeline-content">
          <p className="eyebrow">04 · COMPARE</p>
          <h1>Who feels what — and which conflict feels worse?</h1>
          <p className="timeline-intro">
            Diverging polarity by subreddit, the conflicts found in your file on the same emotional canvas, and a personality fingerprint for each subreddit community.
          </p>

          <div className="pulse-toolbar">
            <button type="button" className="tour-trigger" onClick={() => setTourOpen(true)}>▶ TAKE THE 60-SECOND TOUR</button>
            <button type="button" className="glossary-trigger" onClick={() => setGlossaryOpen(true)}>📖 GLOSSARY</button>
          </div>
          {tourOpen && <PulseTour steps={COMPARE_TOUR_STEPS} onClose={() => setTourOpen(false)}/>}
          {glossaryOpen && <GlossaryModal items={COMPARE_GLOSSARY} onClose={() => setGlossaryOpen(false)}/>}

          <AnalysisFilters filters={filters} onChange={setFilters} defaults={defaults} subredditOptions={detectedSubreddits} conflictOptions={conflictOptions}/>

          {resolving || loading ? (<div className="timeline-chart-empty">Loading your data…</div>) : !runId ? (<NoAnalysisSelected />) : error ? (<div className="timeline-chart-empty">{error}</div>) : !records.length ? (<div className="timeline-chart-empty">This analysis has no scored comments.</div>) : (<>
          {summary && <TrustPanel summary={summary}/>}

          <div className="compare-grid">
            <section className="panel" data-tour="compare-polarity" style={PANEL_COLUMN}>
              <div className="panel-heading">
                <div>
                  <h2>Diverging polarity by subreddit</h2>
                  <p>Mean polarity, −1 to +1</p>
                </div>
                <InfoTip title={INFO.polarity.title}>{INFO.polarity.body}</InfoTip>
              </div>
              <div className="compare-panel-body">
                {subredditRows.length ? <SubredditBars data={subredditRows} metric="polarity"/> : <div className="timeline-chart-empty">{noSubredditsMessage}</div>}
              </div>
              <HowToRead style={{ marginTop: "auto" }}>
                Each bar is one subreddit&rsquo;s <b>average mood</b>. The <b>zero line</b> is neutral: <b>green bars to the right</b> lean positive, <b>red bars to the left</b> lean negative. The <b>longer the bar</b>, the stronger the lean. Hover a bar for the exact score and record count.
              </HowToRead>
            </section>

            <section className="panel" data-tour="compare-sensitivity" style={PANEL_COLUMN}>
              <div className="panel-heading">
                <div>
                  <h2>Mean sensitivity by subreddit</h2>
                  <p>Share of each community's comments dominated by Sensitivity (anger / fear)</p>
                </div>
                <InfoTip title={INFO.sensitivity.title}>{INFO.sensitivity.body}</InfoTip>
              </div>
              <div className="compare-panel-body">
                {subredditRows.length ? <SubredditBars data={subredditRows} metric="sensitivity"/> : <div className="timeline-chart-empty">{noSubredditsMessage}</div>}
              </div>
              <HowToRead style={{ marginTop: "auto" }}>
                Each bar is the <b>percentage of a community&rsquo;s comments</b> that are mainly <b>anger or fear</b>. A <b>longer bar</b> = a more emotionally charged community. Compare it with the polarity chart: a community can be <b>negative but calm</b>, or <b>positive yet highly charged</b>.
              </HowToRead>
            </section>
          </div>

          <section className="panel" data-tour="compare-conflicts" style={{ marginTop: 9 }}>
            <div className="panel-heading">
              <div>
                <h2>Conflict head-to-head</h2>
                <p>{conflictStats.length ? `${conflictStats.map((stat) => stat.name).join(" vs ")} — share of comments per Hourglass dimension` : "Select a conflict to compare"}</p>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
                <div className="legend">
                  {conflictStats.map((stat) => (<span key={stat.name} style={{ marginRight: 10 }}>
                      <i style={{ background: conflictColor(stat.name) }}/>
                      {stat.name}
                    </span>))}
                </div>
                <InfoTip title={INFO.conflicts.title}>{INFO.conflicts.body}</InfoTip>
              </div>
            </div>
            {conflictStats.length ? (<>
                <div style={{ height: 380, padding: "10px 8px 4px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} outerRadius={phone ? "54%" : "72%"}>
                      <PolarGrid stroke="#202931"/>
                      <PolarAngleAxis dataKey="dimension" tick={{ fill: "#8b949c", fontSize: 11 }}/>
                      <PolarRadiusAxis domain={[0, Math.ceil(radarMax * 10) / 10]} tickFormatter={(value: number) => `${Math.round(value * 100)}%`} tick={{ fill: "#66717a", fontSize: 9 }} stroke="#202931"/>
                      {conflictStats.map((stat) => (<Radar key={stat.name} name={stat.name} dataKey={stat.name} stroke={conflictColor(stat.name)} fill={conflictColor(stat.name)} fillOpacity={0.22} strokeWidth={2}/>))}
                      <Tooltip content={<RadarTooltip />}/>
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div className="compare-stats">
                  {conflictStats.map((stat) => (<div key={stat.name}>
                      <span style={{ color: conflictColor(stat.name) }}>{stat.name}</span>
                      <strong>{signed(stat.polarity)}</strong>
                      <small>mean polarity · {stat.n.toLocaleString()} records</small>
                    </div>))}
                  {worst && (<div>
                      <span>FEELS WORSE</span>
                      <strong style={{ color: NEGATIVE }}>{worst.name}</strong>
                      <small>lowest mean polarity</small>
                    </div>)}
                </div>
              </>) : (<div className="timeline-chart-empty">{noConflictMessage}</div>)}
            <HowToRead>
              Each <b>corner</b> is one emotion dimension and each <b>coloured shape</b> is one conflict: the <b>further a shape reaches toward a corner</b>, the bigger that dimension&rsquo;s share of its comments. Where the shapes <b>differ</b> is where the conflicts feel different. The numbers above give each conflict&rsquo;s <b>mean polarity</b> (below zero = negative); <b>FEELS WORSE</b> is simply the lowest one.
            </HowToRead>
          </section>

          <section className="panel" data-tour="compare-fingerprint" style={{ marginTop: 9 }}>
            <div className="panel-heading">
              <div>
                <h2>Subreddit personality fingerprint</h2>
                <p>Share of each community's comments per Hourglass dimension</p>
              </div>
              <InfoTip title={INFO.fingerprint.title}>{INFO.fingerprint.body}</InfoTip>
            </div>
            <div className="fingerprint-grid">
              {subredditRows.map((row) => {
                const values = emotionShares(filterRecords(records, filters, { subreddit: true }).filter((record: ScoredRecord) => normSub(record.subreddit) === normSub(row.name)));
                const data = DIMENSION_KEYS.map((dimension) => ({ dimension: DIMENSION_LABELS[dimension], value: values[dimension] }));
                return (<div className="fingerprint-card" key={row.name}>
                    <h3>{row.name}</h3>
                    <small>
                      polarity {signed(row.polarity)}
                      {` · ${row.n.toLocaleString()} records`}
                    </small>
                    <div style={{ height: 190 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={data} outerRadius={phone ? "56%" : "66%"}>
                          <PolarGrid stroke="#202931"/>
                          <PolarAngleAxis dataKey="dimension" tick={{ fill: "#8b949c", fontSize: 9 }}/>
                          <PolarRadiusAxis domain={[0, Math.max(0.25, ...data.map((item) => item.value))]} tick={false} axisLine={false}/>
                          <Radar dataKey="value" stroke="#f0ae2a" fill="#f0ae2a" fillOpacity={0.25} strokeWidth={1.6}/>
                          <Tooltip content={<RadarTooltip />}/>
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>);
            })}
            </div>
            {!subredditRows.length && <div className="timeline-chart-empty">{noSubredditsMessage}</div>}
            <p className="chart-note">Values are computed from the scored records of your uploaded file{truncated ? ` (an evenly spaced sample of ${records.length.toLocaleString()} of ${summary?.records_after_dedup.toLocaleString()} unique records)` : ""}, so treat small subreddits with caution.</p>
            <HowToRead>
              Each card is <b>one subreddit&rsquo;s emotional personality</b>. The <b>four corners</b> are Pleasantness, Attention, Sensitivity and Aptitude; the <b>gold shape</b> stretches toward the emotions that dominate that community. Look at the <b>shape</b>, not the size: <b>each card has its own scale</b>. Polarity and record count sit under the name; <b>few records = less reliable</b>.
            </HowToRead>
          </section>
          </>)}
        </main>
      </div>
    </div>);
}
function SubredditBars({ data, metric }: {
    data: SubredditRow[];
    metric: "polarity" | "sensitivity";
}) {
    const isPolarity = metric === "polarity";
    const phone = useMediaQuery("(max-width: 620px)");
    return (<ResponsiveContainer width="100%" height={Math.max(190, data.length * 50 + 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }} barCategoryGap="12%">
        <XAxis type="number" domain={isPolarity
            ? [(min: number) => Math.min(-0.1, Math.floor((min - 0.05) * 10) / 10), (max: number) => Math.max(0.1, Math.ceil((max + 0.05) * 10) / 10)]
            : [0, (max: number) => Math.max(0.3, Math.ceil((max + 0.05) * 10) / 10)]} tickFormatter={(value: number) => value.toFixed(1)} tick={AXIS_TICK} axisLine={false} tickLine={false}/>
        <YAxis type="category" dataKey="name" width={phone ? 92 : 118} tick={phone ? { ...LABEL_TICK, fontSize: 10 } : LABEL_TICK} axisLine={false} tickLine={false}/>
        <Tooltip content={<BarTooltip metric={metric}/>} cursor={{ fill: "rgba(255,255,255,0.03)" }}/>
        <Bar dataKey={metric} radius={[2, 2, 2, 2]}>
          {data.map((row) => (<Cell key={row.name} fill={isPolarity ? (row.polarity < 0 ? NEGATIVE : POSITIVE) : BLUE}/>))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>);
}
function BarTooltip({ active, payload, metric }: {
    active?: boolean;
    payload?: {
        value: number;
        payload: SubredditRow;
    }[];
    metric?: string;
}) {
    if (!active || !payload?.length)
        return null;
    const row = payload[0].payload;
    return (<div className="chart-tooltip">
      <span className="chart-tooltip-date">{row.name}</span>
      <span className="chart-tooltip-value">
        {metric} : {metric === "sensitivity" ? pct(payload[0].value) : payload[0].value.toFixed(3)}
      </span>
      {row.n !== null && <span className="chart-tooltip-value">records : {row.n.toLocaleString()}</span>}
    </div>);
}
function RadarTooltip({ active, payload, label }: {
    active?: boolean;
    payload?: {
        name: string;
        value: number;
        color?: string;
    }[];
    label?: string;
}) {
    if (!active || !payload?.length)
        return null;
    return (<div className="chart-tooltip">
      {label && <span className="chart-tooltip-date">{label}</span>}
      {payload.map((item) => (<span key={item.name} className="chart-tooltip-value" style={{ color: item.color }}>
          {item.name} : {pct(item.value)}
        </span>))}
    </div>);
}
export default function CompareRoute() {
    return (<Suspense fallback={null}>
      <CompareInner />
    </Suspense>);
}
