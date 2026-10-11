"use client";
import { useEffect, useState } from "react";
import { getResults, type AnalysisResults } from "@/lib/api";
export const normSub = (value?: string | null) => (value ?? "").trim().toLowerCase().replace(/^\/+/, "").replace(/^r\//, "").replace(/\/+$/, "");
export function detectSubreddits(results: AnalysisResults | null | undefined): string[] {
    const fromSummary = results?.result_summary?.subreddits;
    if (fromSummary?.length)
        return fromSummary.map((item) => item.name);
    const counts = new Map<string, {
        name: string;
        count: number;
    }>();
    for (const record of results?.result_records ?? []) {
        const name = record.subreddit?.trim();
        const key = normSub(name);
        if (!name || !key)
            continue;
        const entry = counts.get(key);
        if (entry)
            entry.count += 1;
        else
            counts.set(key, { name, count: 1 });
    }
    return Array.from(counts.values())
        .sort((a, b) => b.count - a.count)
        .map((item) => item.name);
}
export function useDetectedSubreddits(runId: string | null): string[] {
    const [subreddits, setSubreddits] = useState<string[]>([]);
    useEffect(() => {
        if (!runId) {
            setSubreddits([]);
            return;
        }
        let cancelled = false;
        getResults(runId)
            .then((results) => { if (!cancelled)
            setSubreddits(detectSubreddits(results)); })
            .catch(() => { if (!cancelled)
            setSubreddits([]); });
        return () => { cancelled = true; };
    }, [runId]);
    return subreddits;
}
