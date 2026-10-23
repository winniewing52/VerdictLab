"use client";

import { useMemo, useState } from "react";
import { emotionShares, mean, type ScoredRecord } from "@/lib/analysisData";

const MIN_GROUP_N = 30;

function confidenceInterval(values: number[]) {
  if (values.length < 2)
    return { low: null, high: null };
  const average = mean(values);
  const margin = 1.96 * (Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1)) / Math.sqrt(values.length));
  return { low: average - margin, high: average + margin };
}

export default function RevealPanel({ records }: { records: ScoredRecord[] }) {
  const [revealed, setRevealed] = useState(false);
  const conflicts = useMemo(() => {
    const grouped = new Map<string, ScoredRecord[]>();
    records.forEach((record) => {
      if (!record.conflict)
        return;
      grouped.set(record.conflict, [...(grouped.get(record.conflict) ?? []), record]);
    });
    return Array.from(grouped.entries()).map(([name, rows]) => {
      const interval = confidenceInterval(rows.map((record) => record.source_polarity));
      return { name, rows, n: rows.length, polarity: mean(rows.map((record) => record.source_polarity)), shares: emotionShares(rows), ...interval };
    }).sort((left, right) => left.polarity - right.polarity);
  }, [records]);
  const charged = useMemo(() => {
    const grouped = new Map<string, ScoredRecord[]>();
    records.forEach((record) => {
      const name = record.subreddit?.trim() || "Unlabelled community";
      grouped.set(name, [...(grouped.get(name) ?? []), record]);
    });
    return Array.from(grouped.entries())
      .map(([name, rows]) => ({ name, rows, sensitivity: emotionShares(rows).sensitivity }))
      .sort((left, right) => right.sensitivity - left.sensitivity)[0] ?? null;
  }, [records]);
  const eligible = conflicts.filter((conflict) => conflict.n >= MIN_GROUP_N && conflict.low !== null && conflict.high !== null);
  const lowest = eligible.length > 1 && eligible[0].high! < eligible[1].low! ? eligible[0] : null;
  const focus = lowest ?? conflicts[0] ?? null;
  const example = focus ? focus.rows.slice().sort((a, b) => a.source_polarity - b.source_polarity)[0] : null;

  if (!focus || !charged)
    return null;
  const gap = charged.sensitivity - focus.shares.sensitivity;

  return <section className={`reveal-panel${revealed ? " is-revealed" : ""}`} aria-labelledby="reveal-title">
    <div className="reveal-copy">
      <p className="reveal-kicker">THE 10-SECOND REVEAL</p>
      <h2 id="reveal-title">{lowest ? <><span>{focus.name}</span> has the lowest observed sample mean.</> : <>The signal has a shape.</>}</h2>
      <p className="reveal-lede">
        {charged.name} has the highest sampled Sensitivity share. {lowest ? `${focus.name} has the lowest clearly separated sampled mean polarity.` : "The displayed sample does not show a clear lowest mean at this sample size."}
        <b> Those are different signals.</b>
      </p>
      <button type="button" className="reveal-button" onClick={() => setRevealed((current) => !current)} aria-expanded={revealed}>
        {revealed ? "HIDE THE EVIDENCE" : "SHOW ME THE EVIDENCE"} <span aria-hidden="true">↗</span>
      </button>
    </div>
    <div className="reveal-stat-grid">
      <div className="reveal-stat reveal-stat-negative">
        <span>LOWEST POLARITY</span>
        <strong>{focus.polarity >= 0 ? "+" : ""}{focus.polarity.toFixed(3)}</strong>
        <small>{focus.name} · {focus.n.toLocaleString()} records</small>
      </div>
      <div className="reveal-stat reveal-stat-charged">
        <span>MOST CHARGED</span>
        <strong>{Math.round(charged.sensitivity * 100)}%</strong>
        <small>{charged.name} · sensitivity share</small>
      </div>
    </div>
    {revealed && <div className="reveal-evidence">
      <div>
        <span className="reveal-evidence-label">WHAT THE MODEL FOUND</span>
        <p>{Math.abs(gap) < 0.01 ? "The two signals are almost aligned in this slice." : `${charged.name} has ${Math.round(Math.abs(gap) * 100)} percentage points more Sensitivity than ${focus.name}. A community can sound more emotionally charged without having the lowest overall tone.`}</p>
      </div>
      {example && <blockquote>
        <span className="reveal-evidence-label">ONE RECORD TO CHECK</span>
        “{example.text.trim().length > 220 ? `${example.text.trim().slice(0, 217)}…` : example.text.trim()}”
        <small>{example.conflict} · polarity {example.source_polarity >= 0 ? "+" : ""}{example.source_polarity.toFixed(3)}</small>
      </blockquote>}
      <p className="reveal-boundary">This is a lead, not a verdict. Open the source records and check the context before making a claim.</p>
    </div>}
  </section>;
}
