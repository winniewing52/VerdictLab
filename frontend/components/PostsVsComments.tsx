"use client";
import { useMemo } from "react";
import { mean, sentimentBreakdown, type ScoredRecord } from "@/lib/analysisData";
import { kindOf } from "@/lib/recordKind";
const GROUPS = [
    { kind: "post", title: "POSTS" },
    { kind: "comment", title: "COMMENTS" },
] as const;
const COLORS = { negative: "#ef4e50", neutral: "#6b7280", positive: "#43ba88" };
export default function PostsVsComments({ records }: {
    records: ScoredRecord[];
}) {
    const groups = useMemo(() => GROUPS.map(({ kind, title }) => {
        const rows = records.filter((record) => kindOf(record) === kind);
        return { kind, title, count: rows.length, polarity: mean(rows.map((row) => row.source_polarity)), mix: sentimentBreakdown(rows) };
    }), [records]);
    if (groups.some((group) => group.count === 0))
        return null;
    return (<section className="panel" data-tour="posts-vs-comments">
      <div className="panel-heading">
        <div>
          <h2>Posts vs comments</h2>
          <p>Do thread starters and replies feel different?</p>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
        {groups.map((group) => (<div key={group.kind}>
            <span className="metric-label">{group.title} · {group.count.toLocaleString()}</span>
            <div style={{ fontSize: 28, fontWeight: 600, margin: "6px 0 10px", color: group.polarity < 0 ? COLORS.negative : COLORS.positive }}>
              {group.polarity >= 0 ? "+" : ""}{group.polarity.toFixed(3)}
              <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.7 }}> mean polarity</span>
            </div>
            <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", background: "rgba(128,128,128,0.2)" }} title="negative / neutral / positive">
              <i style={{ width: `${group.mix.negative}%`, background: COLORS.negative }}/>
              <i style={{ width: `${group.mix.neutral}%`, background: COLORS.neutral }}/>
              <i style={{ width: `${group.mix.positive}%`, background: COLORS.positive }}/>
            </div>
            <p style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>
              {group.mix.negative}% negative · {group.mix.neutral}% neutral · {group.mix.positive}% positive
            </p>
          </div>))}
      </div>
      <p className="how-to-read">
        <span>HOW TO READ</span>
        <span>Each bar splits a group into <b>red</b> (negative), <b>grey</b> (neutral) and <b>green</b> (positive). If posts and comments differ a lot, mixing them in one average would hide that.</span>
      </p>
    </section>);
}
