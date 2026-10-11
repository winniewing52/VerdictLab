"use client";
import { Suspense, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import DashboardSidebar from "@/components/DashboardSidebar";
import AnalysisFilters from "@/components/AnalysisFilters";
import InfoTip, { type InfoContent } from "@/components/InfoTip";
import PulseTour, { type TourStep } from "@/components/PulseTour";
import GlossaryModal, { type GlossaryItem } from "@/components/GlossaryModal";
import { getResults } from "@/lib/api";
import { useActiveRun } from "@/lib/useActiveRun";
import { dataDateSpan, filterRecords, useRunData, type ScoredRecord } from "@/lib/analysisData";
import { countKinds, kindOf, recordNouns, type RecordKind } from "@/lib/recordKind";
import NoAnalysisSelected from "@/components/NoAnalysisSelected";
type ResultRecord = ScoredRecord;
type SortKey = "date" | "upvotes" | "polarity";
type SortDir = "asc" | "desc";
const PAGE_SIZE = 25;
const EMOTION_GLYPH: Record<string, string> = { pleasantness: "🙂", attention: "👁️", sensitivity: "💢", aptitude: "🧭" };
const EXPLORER_TOUR_STEPS: TourStep[] = [
    { target: "explorer-export", title: "Export your slice", body: "Download the rows you are looking at. CSV opens in Excel or Google Sheets for your own analysis; BibTeX gives you a ready-made citation for a report or paper." },
    { target: "explorer-table", title: "The table", body: "One row per scored post or comment: date, type, subreddit, conflict, the text itself, score, polarity and emotion. Click DATE, SCORE or POLARITY in the header to sort. Hover the text to read it in full." },
    { target: "explorer-pager", title: "Paging", body: "The table shows 25 rows at a time. Use Prev and Next to move through the whole slice. Changing a filter or the sort takes you back to page 1." },
];
const EXPLORER_GLOSSARY: GlossaryItem[] = [
    { term: "Corpus", plain: "The whole collection of posts and comments in your uploaded file or link.", detail: "The Explorer lets you read it one row at a time instead of only seeing summaries." },
    { term: "Scored record", plain: "A post or comment that has been given a polarity and an emotion.", detail: "Every row in the table is one scored record." },
    { term: "Post", plain: "The message that starts a discussion.", detail: "For example a Reddit thread's title and body, or a YouTube video's title and description." },
    { term: "Comment", plain: "A reply to a post or to another comment.", detail: "Replies are often shorter and more emotional than the post they respond to." },
    { term: "Type", plain: "Whether a row is a post or a comment.", detail: "Detected automatically from the link's structure, or in files from a type column, a parent-ID column or the name of the text column. A dash means we could not tell, and we never guess." },
    { term: "Slice", plain: "The part of the data you are looking at right now.", detail: "Filters for type, conflict, subreddit, dates or keywords change the slice. The heading above the table shows how many rows are in it." },
    { term: "Subreddit", plain: "A Reddit community about a particular topic.", detail: "Shows where the row was posted. A dash means the file had no subreddit for that row." },
    { term: "Conflict", plain: "The topic a row belongs to, such as Israel-Gaza or US-Iran.", detail: "Detected from the text." },
    { term: "Score", plain: "How many people agreed with or amplified it.", detail: "Upvotes on Reddit, likes elsewhere. A high number means it was widely seen or supported. A dash means the file had no score data." },
    { term: "Polarity", plain: "How positive or negative the text is.", detail: "A score from -1 (very negative) to +1 (very positive). Around 0 is neutral. Green means positive, red means negative." },
    { term: "Emotion", plain: "The dominant feeling in the text.", detail: "One of the four Hourglass of Emotions dimensions, shown with a small icon." },
    { term: "Hourglass of Emotions", plain: "A model that describes feelings along four dimensions.", detail: "Pleasantness (joy vs sadness), Attention (interest vs surprise), Sensitivity (fear and anger) and Aptitude (trust vs disgust)." },
    { term: "Sort", plain: "Re-ordering the table by a column.", detail: "Click a header once for high-to-low, click again for low-to-high. The arrow shows the current direction." },
    { term: "Page", plain: "One screenful of 25 rows.", detail: "Use Prev and Next to move between pages. The heading shows which page you are on." },
    { term: "CSV", plain: "A plain spreadsheet file.", detail: "Opens in Excel or Google Sheets. It contains every row in the current slice, not just the page you can see." },
    { term: "BibTeX", plain: "A standard format for academic citations.", detail: "Gives you a ready-to-paste reference describing this corpus, including the number of rows and the date range." },
];
const INFO: Record<"export" | "table", InfoContent> = {
    export: { title: "Export", body: <><b>CSV</b> downloads <b>every row in the current slice</b> (not just the visible page) with date, type, subreddit, conflict, text, score, polarity and emotion. <b>BibTeX</b> downloads a citation entry describing the corpus, including the row count and date range. Both follow your filters.</> },
    table: { title: "Table", body: <>Every <b>scored post or comment</b> in the current slice, 25 per page. Columns: date, type, subreddit, conflict, the text, score, polarity (<b>green</b> positive, <b>red</b> negative) and dominant emotion. <b>Sort</b> by date, score or polarity using the column headers, and hover the text to read it in full.</> },
};
const PANEL_COLUMN: CSSProperties = { display: "flex", flexDirection: "column" };
const KIND_STYLE: Record<RecordKind, {
    label: string;
    color: string;
}> = {
    post: { label: "POST", color: "#f0ae2a" },
    comment: { label: "COMMENT", color: "#08afd4" },
    unknown: { label: "—", color: "#8a8f98" },
};
function KindBadge({ kind }: {
    kind: RecordKind;
}) {
    const { label, color } = KIND_STYLE[kind];
    return (<span style={{ display: "inline-block", padding: "1px 6px", border: `1px solid ${color}`, borderRadius: 4, color, fontSize: 10, letterSpacing: "0.06em", lineHeight: 1.5 }}>
      {label}
    </span>);
}
function HowToRead({ children, style }: {
    children: ReactNode;
    style?: CSSProperties;
}) {
    return <p className="how-to-read" style={style}><span>HOW TO READ</span><span>{children}</span></p>;
}
const displaySub = (value?: string | null) => (value ? value : "—");
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
function csvCell(value: string | number | null | undefined) {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function download(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}
function ExplorerInner() {
    const { runId, resolving } = useActiveRun();
    const { summary, records, filters, setFilters, defaults, conflictOptions, subredditOptions: detectedSubreddits, kindCounts, loading, error } = useRunData(runId, getResults);
    const [sortKey, setSortKey] = useState<SortKey>("date");
    const [sortDir, setSortDir] = useState<SortDir>("desc");
    const [page, setPage] = useState(0);
    const [tourOpen, setTourOpen] = useState(false);
    const [glossaryOpen, setGlossaryOpen] = useState(false);
    const lastRefresh = summary?.trend_dates?.length ? summary.trend_dates[summary.trend_dates.length - 1] : null;
    const dataDefaults = useMemo(() => {
        const span = dataDateSpan(records);
        return { minDate: span.min, maxDate: span.max };
    }, [records]);
    const filtered = useMemo(() => {
        const rows = filterRecords(records, filters);
        const dir = sortDir === "asc" ? 1 : -1;
        const value = (record: ResultRecord): number | string => {
            if (sortKey === "date")
                return record.event_date ?? "";
            if (sortKey === "upvotes")
                return record.upvotes ?? -1;
            return record.source_polarity;
        };
        return [...rows].sort((a, b) => {
            const av = value(a);
            const bv = value(b);
            return av < bv ? -dir : av > bv ? dir : 0;
        });
    }, [records, filters, sortKey, sortDir]);
    const allNouns = recordNouns(kindCounts);
    const nouns = recordNouns(countKinds(filtered.length ? filtered : records));
    const hasKinds = kindCounts.post + kindCounts.comment > 0;
    useEffect(() => setPage(0), [filters, sortKey, sortDir]);
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, pageCount - 1);
    const visible = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);
    const toggleSort = (key: SortKey) => {
        if (key === sortKey)
            setSortDir((dir) => (dir === "desc" ? "asc" : "desc"));
        else {
            setSortKey(key);
            setSortDir("desc");
        }
    };
    const sortMark = (key: SortKey) => (key === sortKey ? (sortDir === "desc" ? "↓" : "↑") : "⇅");
    const exportCsv = () => {
        const header = ["date", "type", "subreddit", "conflict", "text", "score", "polarity", "emotion"];
        const lines = filtered.map((record) => [record.event_date, kindOf(record), record.subreddit, record.conflict, record.text, record.upvotes, record.source_polarity, record.emotion].map(csvCell).join(","));
        download(`explorer-${runId ?? "export"}.csv`, "\uFEFF" + [header.join(","), ...lines].join("\r\n"), "text/csv;charset=utf-8");
    };
    const exportBibtex = () => {
        const year = (dataDefaults.maxDate ?? new Date().toISOString()).slice(0, 4);
        const key = `verdictlab_${(runId ?? "corpus").replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}`;
        const span = dataDefaults.minDate && dataDefaults.maxDate ? `, ${dataDefaults.minDate} to ${dataDefaults.maxDate}` : "";
        const bib = `@misc{${key},
  title        = {Scored corpus (${filtered.length.toLocaleString()} of ${records.length.toLocaleString()} ${allNouns.plural}${span})},
  author       = {{Group MDS05}},
  year         = {${year}},
  howpublished = {VerdictLab (SenticNet 7 analysis run ${runId ?? "n/a"})},
  note         = {Accessed ${new Date().toISOString().slice(0, 10)}}
}
`;
        download(`explorer-${runId ?? "export"}.bib`, bib, "text/plain;charset=utf-8");
    };
    const hasRecords = records.length > 0;
    return (<div className="pulse-app timeline-app">
      <DashboardSidebar active="Explorer" runId={runId}/>
      <div className="dashboard-shell">
        <div className="topbar">
          <span>
            <i className="live-dot"/> live build
            {summary && <> · {summary.total_records.toLocaleString()} {allNouns.plural} indexed</>}
            {lastRefresh && <> · last refresh {lastRefresh}</>}
          </span>
          <span>
            Group MDS05 <b>|</b> Supervisor: Ganesh Krishnasamy
          </span>
        </div>
        <main className="dashboard-content timeline-content">
          <div className="explorer-head">
            <div>
              <p className="eyebrow">05 · EXPLORER</p>
              <h1>The corpus, row by row</h1>
              <p className="timeline-intro">
                Drill into individual scored {allNouns.plural} from your uploaded file or link. Filter by type to separate thread starters from replies, sort by polarity to find the loudest voices, or by score to find the most-amplified ones. Export to CSV for further analysis or to BibTeX for academic citation.
              </p>
            </div>
            <div className="explorer-actions" data-tour="explorer-export" style={{ alignItems: "center" }}>
              <button type="button" onClick={exportCsv} disabled={!filtered.length}>⤓ CSV</button>
              <button type="button" onClick={exportBibtex} disabled={!hasRecords}>⤓ BibTeX</button>
              <InfoTip title={INFO.export.title}>{INFO.export.body}</InfoTip>
            </div>
          </div>

          <div className="pulse-toolbar">
            <button type="button" className="tour-trigger" onClick={() => setTourOpen(true)}>▶ TAKE THE 60-SECOND TOUR</button>
            <button type="button" className="glossary-trigger" onClick={() => setGlossaryOpen(true)}>📖 GLOSSARY</button>
          </div>
          {tourOpen && <PulseTour steps={EXPLORER_TOUR_STEPS} onClose={() => setTourOpen(false)}/>}
          {glossaryOpen && <GlossaryModal items={EXPLORER_GLOSSARY} onClose={() => setGlossaryOpen(false)}/>}

          <AnalysisFilters filters={filters} onChange={setFilters} subredditOptions={detectedSubreddits} defaults={defaults} conflictOptions={conflictOptions} kindCounts={kindCounts}/>

          {!resolving && !loading && !runId ? (<NoAnalysisSelected />) : (<section className="panel explorer-panel" data-tour="explorer-table" style={PANEL_COLUMN}>
            <div className="panel-heading">
              <div>
                <h2>{filtered.length.toLocaleString()} {nouns.plural} in this slice</h2>
                <p>{hasRecords ? `Page ${currentPage + 1} of ${pageCount}` : "No data loaded"}</p>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
                <div className="explorer-pager" data-tour="explorer-pager">
                  <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Prev</button>
                  <button type="button" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>Next</button>
                </div>
                <InfoTip title={INFO.table.title}>{INFO.table.body}</InfoTip>
              </div>
            </div>

            {resolving || loading ? (<div className="timeline-chart-empty">Loading…</div>) : error ? (<div className="timeline-chart-empty">{error}</div>) : !hasRecords ? (<div className="timeline-chart-empty">This analysis has no scored records.</div>) : !filtered.length ? (<div className="timeline-chart-empty">No {nouns.plural} match the current filters.</div>) : (<div className="explorer-table-wrap">
                <table className="explorer-table">
                  <thead>
                    <tr>
                      <th><button type="button" className={sortKey === "date" ? "active" : ""} onClick={() => toggleSort("date")}>DATE {sortMark("date")}</button></th>
                      {hasKinds && <th>TYPE</th>}
                      <th>SUBREDDIT</th>
                      <th>CONFLICT</th>
                      <th>TEXT</th>
                      <th className="num"><button type="button" className={sortKey === "upvotes" ? "active" : ""} onClick={() => toggleSort("upvotes")}>SCORE {sortMark("upvotes")}</button></th>
                      <th className="num"><button type="button" className={sortKey === "polarity" ? "active" : ""} onClick={() => toggleSort("polarity")}>POLARITY {sortMark("polarity")}</button></th>
                      <th className="num">EMOTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((record, index) => (<tr key={`${currentPage}-${index}`}>
                        <td className="mono">{record.event_date ?? "—"}</td>
                        {hasKinds && <td className="mono"><KindBadge kind={kindOf(record)}/></td>}
                        <td className="mono">{displaySub(record.subreddit)}</td>
                        <td className="mono dim">{record.conflict ?? "—"}</td>
                        <td className="comment" title={record.text}>{record.text}</td>
                        <td className="num mono">{record.upvotes ?? "—"}</td>
                        <td className={`num mono ${record.source_polarity < 0 ? "neg" : "pos"}`}>{signed(record.source_polarity)}</td>
                        <td className="num mono">
                          <span className="emo-glyph" aria-hidden="true">{EMOTION_GLYPH[record.emotion ?? ""] ?? "•"}</span> {record.emotion ?? "—"}
                        </td>
                      </tr>))}
                  </tbody>
                </table>
              </div>)}
            <HowToRead style={{ marginTop: "auto" }}>
              Each <b>row is one {nouns.singular}</b>{hasKinds && <>, tagged <b>POST</b> (starts a discussion) or <b>COMMENT</b> (a reply). Use the <b>TYPE</b> filter above to look at one kind</>}. <b>Polarity</b> runs from -1 to +1: <b>green</b> = positive, <b>red</b> = negative, and the icon beside <b>emotion</b> shows its dominant feeling. Click <b>DATE</b>, <b>SCORE</b> or <b>POLARITY</b> to sort, hover the text to read it in full, use <b>Prev / Next</b> to page through, and use <b>CSV</b> or <b>BibTeX</b> at the top to export everything in this slice.
            </HowToRead>
          </section>)}
        </main>
      </div>
    </div>);
}
export default function ExplorerRoute() {
    return (<Suspense fallback={null}>
      <ExplorerInner />
    </Suspense>);
}
