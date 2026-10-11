"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AnalysisResults } from "@/lib/api";
import type { AnalysisFilterState } from "@/components/AnalysisFilters";
import { detectSubreddits, normSub } from "@/lib/subreddits";
import { countKinds, kindOf } from "@/lib/recordKind";
export type ScoredRecord = NonNullable<AnalysisResults["result_records"]>[number];
export const DIMENSION_KEYS = ["pleasantness", "attention", "sensitivity", "aptitude"] as const;
export type DimensionKey = (typeof DIMENSION_KEYS)[number];
export const DIMENSION_LABELS: Record<DimensionKey, string> = {
    pleasantness: "Pleasantness",
    attention: "Attention",
    sensitivity: "Sensitivity",
    aptitude: "Aptitude",
};
export const DIMENSION_COLORS: Record<DimensionKey, string> = {
    pleasantness: "#2dd4bf",
    attention: "#a78bfa",
    sensitivity: "#fb7185",
    aptitude: "#43ba88",
};
export const CONFLICT_PALETTE = ["#f0ae2a", "#ef4e50", "#08afd4", "#43ba88", "#a78bfa", "#fb7185"];
export const mean = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
export const round3 = (value: number) => Math.round(value * 1000) / 1000;
export function detectConflicts(records: ScoredRecord[]): string[] {
    const counts = new Map<string, number>();
    for (const record of records)
        if (record.conflict)
            counts.set(record.conflict, (counts.get(record.conflict) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([name]) => name);
}
export function dataDateSpan(records: ScoredRecord[]): {
    min?: string;
    max?: string;
} {
    const dates = records.map((record) => record.event_date).filter((value): value is string => !!value).sort();
    return { min: dates[0], max: dates[dates.length - 1] };
}
export function filterRecords(records: ScoredRecord[], filters: AnalysisFilterState, skip?: {
    conflict?: boolean;
    subreddit?: boolean;
}): ScoredRecord[] {
    const keyword = filters.keyword.trim().toLowerCase();
    return records.filter((record) => {
        if (record.event_date) {
            if (filters.startDate && record.event_date < filters.startDate)
                return false;
            if (filters.endDate && record.event_date > filters.endDate)
                return false;
        }
        if (!skip?.conflict && record.conflict && !filters.selectedConflicts.includes(record.conflict))
            return false;
        if (!skip?.subreddit && filters.selectedSubreddits.length && record.subreddit && !filters.selectedSubreddits.some((name) => normSub(name) === normSub(record.subreddit)))
            return false;
        if (keyword && !record.text.toLowerCase().includes(keyword))
            return false;
        if (filters.kind && filters.kind !== "all" && kindOf(record) !== filters.kind)
            return false;
        return true;
    });
}
const FILTER_STORAGE_PREFIX = "verdictlab:filters:";
function loadSavedFilters(runKey: string, defaults: AnalysisFilterState): AnalysisFilterState | null {
    try {
        const raw = window.sessionStorage.getItem(FILTER_STORAGE_PREFIX + runKey);
        if (!raw)
            return null;
        const saved = JSON.parse(raw) as Partial<AnalysisFilterState>;
        const strings = (value: unknown): string[] | null => (Array.isArray(value) && value.every((item) => typeof item === "string") ? (value as string[]) : null);
        const date = (value: unknown, fallback: string) => (typeof value === "string" && (value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value)) ? value : fallback);
        return {
            selectedConflicts: strings(saved.selectedConflicts) ?? defaults.selectedConflicts,
            selectedSubreddits: strings(saved.selectedSubreddits) ?? defaults.selectedSubreddits,
            startDate: date(saved.startDate, defaults.startDate),
            endDate: date(saved.endDate, defaults.endDate),
            keyword: typeof saved.keyword === "string" ? saved.keyword : defaults.keyword,
            kind: saved.kind === "post" || saved.kind === "comment" || saved.kind === "all" ? saved.kind : defaults.kind,
        };
    }
    catch {
        return null;
    }
}
function saveFilters(runKey: string, filters: AnalysisFilterState) {
    try {
        window.sessionStorage.setItem(FILTER_STORAGE_PREFIX + runKey, JSON.stringify(filters));
    }
    catch {
    }
}
export function useSliceFilters(results: AnalysisResults | null) {
    const records = useMemo(() => (results?.result_records ?? []) as ScoredRecord[], [results]);
    const conflictOptions = useMemo(() => detectConflicts(records), [records]);
    const subredditOptions = useMemo(() => detectSubreddits(results), [results]);
    const span = useMemo(() => dataDateSpan(records), [records]);
    const runKey = results?.id ?? null;
    const defaults = useMemo<AnalysisFilterState>(() => ({ selectedConflicts: conflictOptions, selectedSubreddits: [], startDate: span.min ?? "", endDate: span.max ?? "", keyword: "", kind: "all" }), [conflictOptions, span.min, span.max]);
    const [filters, setFiltersState] = useState<AnalysisFilterState>(defaults);
    useEffect(() => {
        setFiltersState((runKey && loadSavedFilters(runKey, defaults)) || defaults);
    }, [defaults, runKey]);
    const setFilters = useCallback((next: AnalysisFilterState) => {
        setFiltersState(next);
        if (runKey)
            saveFilters(runKey, next);
    }, [runKey]);
    const filtered = useMemo(() => filterRecords(records, filters), [records, filters]);
    const kindCounts = useMemo(() => countKinds(records), [records]);
    return { records, filtered, filters, setFilters, defaults, conflictOptions, subredditOptions, kindCounts };
}
export function useRunData(runId: string | null, loader: (id: string) => Promise<AnalysisResults>) {
    const [results, setResults] = useState<AnalysisResults | null>(null);
    const [loading, setLoading] = useState(!!runId);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        if (!runId)
            return;
        let cancelled = false;
        setLoading(true);
        loader(runId)
            .then((data) => { if (!cancelled) {
            setResults(data);
            setError(null);
        } })
            .catch(() => { if (!cancelled)
            setError("Could not load this analysis. Make sure the backend is running and the run exists."); })
            .finally(() => { if (!cancelled)
            setLoading(false); });
        return () => { cancelled = true; };
    }, [runId, loader]);
    const slice = useSliceFilters(results);
    return { results, summary: results?.result_summary ?? null, ...slice, loading, error };
}
export function sentimentOf(record: ScoredRecord): "positive" | "neutral" | "negative" {
    const value = (record.source_label ?? record.label ?? "").toLowerCase();
    return value.includes("pos") ? "positive" : value.includes("neg") ? "negative" : "neutral";
}
export function sentimentBreakdown(records: ScoredRecord[]) {
    const total = records.length || 1;
    const count = (label: string) => records.filter((record) => sentimentOf(record) === label).length;
    return {
        positive: Math.round((1000 * count("positive")) / total) / 10,
        neutral: Math.round((1000 * count("neutral")) / total) / 10,
        negative: Math.round((1000 * count("negative")) / total) / 10,
    };
}
const emotionOf = (record: ScoredRecord): DimensionKey | null => {
    const value = (record.emotion ?? "").toLowerCase();
    return (DIMENSION_KEYS as readonly string[]).includes(value) ? (value as DimensionKey) : null;
};
export function emotionShares(records: ScoredRecord[]): Record<DimensionKey, number> {
    const counts: Record<DimensionKey, number> = { pleasantness: 0, attention: 0, sensitivity: 0, aptitude: 0 };
    let total = 0;
    for (const record of records) {
        const key = emotionOf(record);
        if (key) {
            counts[key] += 1;
            total += 1;
        }
    }
    return {
        pleasantness: total ? round3(counts.pleasantness / total) : 0,
        attention: total ? round3(counts.attention / total) : 0,
        sensitivity: total ? round3(counts.sensitivity / total) : 0,
        aptitude: total ? round3(counts.aptitude / total) : 0,
    };
}
export function dominantEmotion(records: ScoredRecord[]): DimensionKey | null {
    const shares = emotionShares(records);
    const best = DIMENSION_KEYS.reduce((a, b) => (shares[b] > shares[a] ? b : a));
    return shares[best] > 0 ? best : null;
}
export function topConflict(records: ScoredRecord[]): string | null {
    const counts = new Map<string, number>();
    for (const record of records)
        if (record.conflict)
            counts.set(record.conflict, (counts.get(record.conflict) ?? 0) + 1);
    const best = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
    return best ? best[0] : null;
}
export type ScaleMode = {
    kind: "date";
} | {
    kind: "time";
    date: string;
    bucketMinutes: number;
};
const minutesOfDay = (time?: string | null): number | null => {
    const match = /T(\d{2}):(\d{2})/.exec(time ?? "");
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};
const BUCKET_CHOICES = [1, 2, 5, 10, 15, 30, 60];
export function detectScale(records: ScoredRecord[]): ScaleMode {
    const dates = new Set<string>();
    for (const record of records)
        if (record.event_date)
            dates.add(record.event_date);
    if (dates.size !== 1)
        return { kind: "date" };
    const minutes = records.map((record) => minutesOfDay(record.event_time)).filter((value): value is number => value !== null);
    if (new Set(minutes).size < 2)
        return { kind: "date" };
    const span = Math.max(...minutes) - Math.min(...minutes);
    const bucketMinutes = BUCKET_CHOICES.find((size) => span / size <= 48) ?? 60;
    return { kind: "time", date: Array.from(dates)[0], bucketMinutes };
}
const pad = (value: number) => String(value).padStart(2, "0");
export function scaleKey(record: ScoredRecord, mode: ScaleMode): string | null {
    if (mode.kind === "date")
        return record.event_date ?? null;
    const minutes = minutesOfDay(record.event_time);
    if (minutes === null)
        return null;
    const floored = Math.floor(minutes / mode.bucketMinutes) * mode.bucketMinutes;
    return `${pad(Math.floor(floored / 60))}:${pad(floored % 60)}`;
}
export function scaleText(mode: ScaleMode) {
    return mode.kind === "date"
        ? { unit: "day", rolling: "3-day rolling", per: "daily", peak: "DAY" }
        : { unit: "time", rolling: `3-point rolling (${mode.bucketMinutes}-min buckets)`, per: `per ${mode.bucketMinutes}-minute`, peak: "TIME" };
}
export function whenLabel(record: ScoredRecord): string {
    if (record.event_time && record.event_date && minutesOfDay(record.event_time) !== null)
        return `${record.event_date} ${record.event_time.slice(11, 16)}`;
    return record.event_date ?? "";
}
export type DailyPoint = {
    date: string;
    volume: number;
    polarity: number;
    raw: number;
} & Record<DimensionKey, number>;
export function dailySeries(records: ScoredRecord[], window = 3, mode: ScaleMode = detectScale(records)): DailyPoint[] {
    const byKey = new Map<string, ScoredRecord[]>();
    for (const record of records) {
        const key = scaleKey(record, mode);
        if (!key)
            continue;
        const list = byKey.get(key);
        if (list)
            list.push(record);
        else
            byKey.set(key, [record]);
    }
    const keys = Array.from(byKey.keys()).sort();
    const means = keys.map((key) => mean(byKey.get(key)!.map((record) => record.source_polarity)));
    return keys.map((key, index) => {
        const rows = byKey.get(key)!;
        return {
            date: key,
            volume: rows.length,
            raw: round3(means[index]),
            polarity: round3(mean(means.slice(Math.max(0, index - window + 1), index + 1))),
            ...emotionShares(rows),
        };
    });
}
export function mostVolatileDay(records: ScoredRecord[], mode: ScaleMode = detectScale(records)): {
    date: string;
    spread: number;
} | null {
    const byKey = new Map<string, number[]>();
    for (const record of records) {
        const key = scaleKey(record, mode);
        if (!key)
            continue;
        const list = byKey.get(key);
        if (list)
            list.push(record.source_polarity);
        else
            byKey.set(key, [record.source_polarity]);
    }
    let best: {
        date: string;
        spread: number;
    } | null = null;
    for (const [key, values] of byKey) {
        if (values.length < 2)
            continue;
        const spread = Math.max(...values) - Math.min(...values);
        if (!best || spread > best.spread)
            best = { date: key, spread: round3(spread) };
    }
    return best;
}
const STOPWORDS = new Set(["the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "to", "of", "in", "on", "for", "it", "this", "that", "with", "as", "at", "be", "i", "you", "he", "she", "they", "we", "not", "so", "if", "than", "then", "just", "like", "have", "has", "had", "do", "does", "did", "im", "its", "from", "what", "will", "would", "could", "should", "there", "their", "about", "your", "been", "more", "when", "them", "some", "because", "which", "also", "into", "only", "other", "people", "really", "think", "dont", "cant", "thats", "were"]);
export function topConcepts(records: ScoredRecord[], limit = 36) {
    const stats = new Map<string, {
        count: number;
        emotions: Record<DimensionKey, number>;
    }>();
    for (const record of records) {
        const emotion = emotionOf(record);
        const seen = new Set<string>();
        for (const word of record.text.toLowerCase().match(/[a-z']{4,}/g) ?? []) {
            if (STOPWORDS.has(word) || seen.has(word))
                continue;
            seen.add(word);
            let entry = stats.get(word);
            if (!entry) {
                entry = { count: 0, emotions: { pleasantness: 0, attention: 0, sensitivity: 0, aptitude: 0 } };
                stats.set(word, entry);
            }
            entry.count += 1;
            if (emotion)
                entry.emotions[emotion] += 1;
        }
    }
    return Array.from(stats.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, limit)
        .map(([text, entry]) => ({
        text,
        count: entry.count,
        emotion: DIMENSION_KEYS.reduce((a, b) => (entry.emotions[b] > entry.emotions[a] ? b : a)),
    }));
}
export function formatDate(value?: string | null): string | null {
    if (!value)
        return null;
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()))
        return null;
    return parsed.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" });
}
