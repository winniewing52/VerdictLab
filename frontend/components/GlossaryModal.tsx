"use client";
import { useEffect, useMemo, useState } from "react";
export type GlossaryItem = {
    term: string;
    plain: string;
    detail: string;
};
export const GLOSSARY: GlossaryItem[] = [
    { term: "Polarity", plain: "How positive or negative a comment is.", detail: "A score from -1 (very angry or negative) to +1 (very happy or positive). Around 0 means neutral." },
    { term: "Mean polarity", plain: "The average mood of every comment in the current slice.", detail: "Negative numbers mean the crowd leans negative overall." },
    { term: "VADER", plain: "A ready-made tool that scores the tone of short, informal text.", detail: "Good with social media language, capitals and punctuation. Shown next to polarity as a second opinion." },
    { term: "TextBlob", plain: "A second sentiment scorer used to cross-check VADER.", detail: "When two tools agree, the result is more trustworthy." },
    { term: "Sentiment bucket", plain: "The label each comment gets: negative, neutral or positive.", detail: "Every comment sits in exactly one bucket, so the shares add up to 100%." },
    { term: "Rolling mean", plain: "An average that smooths out day-to-day noise.", detail: "Each point on the trend line averages the last 3 days, so one odd day doesn't dominate." },
    { term: "Normal range (shaded band)", plain: "The usual up-and-down of mood in this slice.", detail: "Points that fall outside the band are unusual days worth investigating." },
    { term: "Most volatile day", plain: "The day when opinions were furthest apart.", detail: "Polarity spread is the gap between the happiest and angriest comment that day." },
    { term: "Hourglass of Emotions", plain: "A model that describes feelings along four dimensions.", detail: "Each comment is tagged with the dimension that dominates it." },
    { term: "Pleasantness", plain: "Joy vs sadness.", detail: "Is the person happy or upset?" },
    { term: "Attention", plain: "Interest vs surprise or boredom.", detail: "How engaged or alert the person sounds." },
    { term: "Sensitivity", plain: "Fear and anger.", detail: "How emotionally reactive the comment is. High sensitivity often means distress." },
    { term: "Aptitude", plain: "Trust vs disgust.", detail: "How much the person accepts or rejects what they are talking about." },
    { term: "Slice", plain: "The part of the data you are looking at right now.", detail: "Filters for conflict, subreddit, dates or keywords change the slice, and every number updates." },
];
export default function GlossaryModal({ onClose, items: source = GLOSSARY }: {
    onClose: () => void;
    items?: GlossaryItem[];
}) {
    const [query, setQuery] = useState("");
    const items = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? source.filter((g) => `${g.term} ${g.plain} ${g.detail}`.toLowerCase().includes(q)) : source;
    }, [query, source]);
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => { if (event.key === "Escape")
            onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);
    return (<div className="glossary-overlay" role="dialog" aria-modal="true" aria-label="Glossary" onClick={onClose}>
      <div className="glossary-modal" onClick={(event) => event.stopPropagation()}>
        <div className="glossary-head">
          <div><p className="eyebrow">GLOSSARY</p><h2>What the words mean</h2></div>
          <button type="button" onClick={onClose} aria-label="Close glossary">×</button>
        </div>
        <input className="glossary-search" placeholder="Search a term…" value={query} onChange={(event) => setQuery(event.target.value)} autoFocus/>
        <dl className="glossary-list">
          {items.length ? items.map((g) => <div key={g.term}><dt>{g.term}</dt><dd><b>{g.plain}</b> {g.detail}</dd></div>) : <p className="glossary-empty">No matching terms.</p>}
        </dl>
      </div>
    </div>);
}
