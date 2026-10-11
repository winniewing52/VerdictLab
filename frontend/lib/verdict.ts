import type { Analysis, AnalysisResults } from "@/lib/api";
import { DIMENSION_KEYS, DIMENSION_LABELS, type DimensionKey, type ScoredRecord, dailySeries, dataDateSpan, dominantEmotion, emotionShares, formatDate, mostVolatileDay, topConflict, } from "@/lib/analysisData";
export type VerdictTone = "negative" | "positive" | "neutral" | "divided";
export const TONE_COLORS: Record<VerdictTone, string> = {
    negative: "#ef4e50",
    positive: "#43ba88",
    neutral: "#08afd4",
    divided: "#f0ae2a",
};
export const TONE_COLORS_PAPER: Record<VerdictTone, string> = {
    negative: "#e0483f",
    positive: "#2fa36f",
    neutral: "#0b93b3",
    divided: "#d99413",
};
export type Verdict = {
    runId: string;
    title: string;
    source: string;
    generatedOn: string;
    dateRange: string | null;
    tone: VerdictTone;
    word: string;
    headline: string;
    plain: string;
    polarity: number;
    vader: number;
    breakdown: {
        positive: number;
        neutral: number;
        negative: number;
    };
    totalRecords: number;
    uniqueRecords: number;
    sampleSize: number;
    emotion: string | null;
    emotionShare: number | null;
    emotionShares: Record<DimensionKey, number>;
    conflict: string | null;
    volatileDay: {
        date: string;
        spread: number;
    } | null;
    topics: string[];
    quality: number | null;
    agreement: {
        agree: boolean;
        gap: number;
        text: string;
    };
    confidence: "High" | "Medium" | "Low";
    trend: {
        date: string;
        polarity: number;
    }[];
    voices: {
        negative: ScoredRecord[];
        positive: ScoredRecord[];
    };
};
export function downsample<T>(items: T[], max: number): T[] {
    if (items.length <= max)
        return items;
    const step = (items.length - 1) / (max - 1);
    return Array.from({ length: max }, (_, i) => items[Math.round(i * step)]);
}
function asDimension(value?: string | null): DimensionKey | null {
    const key = (value ?? "").trim().toLowerCase();
    return (DIMENSION_KEYS as readonly string[]).includes(key) ? (key as DimensionKey) : null;
}
function sourceLabel(analysis: Analysis): string {
    const kind = analysis.source_type === "reddit" ? "Reddit" : analysis.source_type === "youtube" ? "YouTube" : "Uploaded dataset";
    if (!analysis.source_url)
        return kind;
    const clean = analysis.source_url.replace(/^https?:\/\/(www\.|old\.)?/i, "").replace(/\/$/, "");
    return `${kind} · ${clean.length > 64 ? `${clean.slice(0, 61)}…` : clean}`;
}
export function buildVerdict(analysis: Analysis, results: AnalysisResults): Verdict | null {
    const summary = results.result_summary;
    if (!summary)
        return null;
    const records = (results.result_records ?? []) as ScoredRecord[];
    const { positive, neutral, negative } = summary.sentiment_breakdown;
    const net = positive - negative;
    const tone: VerdictTone = net <= -10 ? "negative" : net >= 10 ? "positive" : neutral >= 45 ? "neutral" : "divided";
    const word = tone.toUpperCase();
    const headline = tone === "negative"
        ? `Negative sentiment dominates: ${negative}% of comments sound upset, critical or hostile.`
        : tone === "positive"
            ? `Positive sentiment leads: ${positive}% of comments sound supportive or hopeful.`
            : tone === "neutral"
                ? `Mostly emotionally flat: ${neutral}% of comments are factual or neutral in tone.`
                : `No clear winner: opinion is split ${positive}% positive vs ${negative}% negative.`;
    const plain = tone === "negative"
        ? negative > 50
            ? "In plain English: more than half of the comments sound upset, critical or hostile."
            : "In plain English: the largest group of comments sounds upset, critical or hostile."
        : tone === "positive"
            ? "In plain English: the largest group of comments sounds supportive or hopeful."
            : tone === "neutral"
                ? "In plain English: most comments are factual and carry little emotional charge."
                : "In plain English: supportive and critical voices are close to evenly matched.";
    const polarity = summary.avg_source_polarity ?? summary.avg_textblob_score;
    const vader = summary.avg_vader_score;
    const gap = Math.abs(polarity - vader);
    const sign = (n: number) => (Math.abs(n) < 0.05 ? 0 : Math.sign(n));
    const agree = sign(polarity) === sign(vader) || gap < 0.15;
    const agreement = {
        agree,
        gap,
        text: agree
            ? `VADER and TextBlob agree on the overall tone (gap ${gap.toFixed(2)}), so the verdict is cross-checked.`
            : `VADER and TextBlob disagree (gap ${gap.toFixed(2)}). Read the verdict with caution.`,
    };
    const unique = summary.records_after_dedup;
    const confidence: Verdict["confidence"] = unique >= 1000 && agree ? "High" : (unique >= 200 && agree) || (unique >= 1000 && !agree) ? "Medium" : "Low";
    const shares = emotionShares(records);
    const emotionKey = dominantEmotion(records) ?? asDimension(summary.dominant_emotion);
    const conflictFromSummary = summary.top_conflict && summary.top_conflict !== "Not available" ? summary.top_conflict : null;
    const span = dataDateSpan(records);
    const from = formatDate(span.min);
    const to = formatDate(span.max);
    const dateRange = from && to ? (from === to ? from : `${from} – ${to}`) : null;
    const usable = records.filter((r) => r.text && r.text.trim().length >= 25);
    const ascending = [...usable].sort((a, b) => a.source_polarity - b.source_polarity);
    const negativeVoices = ascending.filter((r) => r.source_polarity < 0).slice(0, 2);
    const positiveVoices = [...ascending].reverse().filter((r) => r.source_polarity > 0).slice(0, 2);
    return {
        runId: analysis.id,
        title: analysis.title,
        source: sourceLabel(analysis),
        generatedOn: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        dateRange,
        tone,
        word,
        headline,
        plain,
        polarity,
        vader,
        breakdown: { positive, neutral, negative },
        totalRecords: summary.total_records,
        uniqueRecords: unique,
        sampleSize: records.length,
        emotion: emotionKey ? DIMENSION_LABELS[emotionKey] : null,
        emotionShare: emotionKey && shares[emotionKey] > 0 ? shares[emotionKey] : null,
        emotionShares: shares,
        conflict: topConflict(records) ?? conflictFromSummary,
        volatileDay: mostVolatileDay(records),
        topics: (summary.top_topics ?? []).slice(0, 10),
        quality: summary.quality_score ?? null,
        agreement,
        confidence,
        trend: dailySeries(records).map((point) => ({ date: point.date, polarity: point.polarity })),
        voices: { negative: negativeVoices, positive: positiveVoices },
    };
}
export const signed = (value: number, digits = 3) => `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
export function verdictSummaryText(v: Verdict): string {
    const lines = [
        `VerdictLab verdict: ${v.title}`,
        `${v.word} — ${v.headline}`,
        "",
        `Mean polarity ${signed(v.polarity)} (VADER ${signed(v.vader)}) · ${v.totalRecords.toLocaleString()} comments analysed, ${v.uniqueRecords.toLocaleString()} unique`,
        `Sentiment: ${v.breakdown.negative}% negative · ${v.breakdown.neutral}% neutral · ${v.breakdown.positive}% positive`,
        `Dominant emotion: ${v.emotion ?? "n/a"} · Top conflict: ${v.conflict ?? "none detected"}`,
        `Confidence: ${v.confidence} (${v.agreement.agree ? "models agree" : "models disagree"})`,
        "",
        `${v.source}${v.dateRange ? ` · ${v.dateRange}` : ""}`,
        `Run ${v.runId} · ${v.generatedOn}`,
    ];
    return lines.join("\n");
}
