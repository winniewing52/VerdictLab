import type { AnalysisResults } from "@/lib/api";

export default function SampleNotice({ summary, recordsLength }: {
    summary?: NonNullable<AnalysisResults["result_summary"]> | null;
    recordsLength: number;
}) {
    if (!summary || summary.records_after_dedup <= recordsLength)
        return null;
    return <p className="coverage">Based on {recordsLength.toLocaleString()} evenly spaced records out of {summary.records_after_dedup.toLocaleString()} cleaned records.</p>;
}
