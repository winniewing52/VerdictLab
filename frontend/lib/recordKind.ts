export type RecordKind = "post" | "comment" | "unknown";
export type KindFilter = "all" | "post" | "comment";
export type KindCounts = Record<RecordKind, number>;
export const kindOf = (record: {
    kind?: string | null;
}): RecordKind => record.kind === "post" || record.kind === "comment" ? record.kind : "unknown";
export function countKinds(records: {
    kind?: string | null;
}[]): KindCounts {
    const counts: KindCounts = { post: 0, comment: 0, unknown: 0 };
    for (const record of records)
        counts[kindOf(record)] += 1;
    return counts;
}
export function recordNouns(counts: KindCounts): {
    plural: string;
    singular: string;
} {
    const { post, comment, unknown } = counts;
    if (post > 0 && comment > 0)
        return { plural: "posts & comments", singular: "post or comment" };
    if (post > 0 && comment === 0 && unknown === 0)
        return { plural: "posts", singular: "post" };
    if (comment > 0 && post === 0 && unknown === 0)
        return { plural: "comments", singular: "comment" };
    return { plural: "records", singular: "record" };
}
