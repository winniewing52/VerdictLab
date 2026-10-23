"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardSidebar from "@/components/DashboardSidebar";
import Mds05Summary from "@/components/Mds05Summary";
import NoAnalysisSelected from "@/components/NoAnalysisSelected";
import { AccountError, clearLastRunId, getAnalysis, getResults, setLastRunId, type AnalysisResults } from "@/lib/api";
import { useActiveRun } from "@/lib/useActiveRun";
import { isDemoPath } from "@/lib/demo";

function WorkspaceSummaryInner() {
  const router = useRouter();
  const { runId, resolving, error: resolveError, retry } = useActiveRun();
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;
    const analysisId = runId;
    let stopped = false;
    async function load() {
      try {
        const analysis = await getAnalysis(analysisId);
        if (stopped) return;
        if (analysis.is_demo && !isDemoPath(window.location.pathname)) {
          router.replace("/demo");
          return;
        }
        setLastRunId(analysisId);
        if (analysis.status === "complete") {
          setResults(await getResults(analysisId));
        } else if (analysis.status !== "failed") {
          window.setTimeout(load, 1200);
        } else {
          setError(analysis.error ?? "This analysis failed.");
        }
      } catch (loadError) {
        if (stopped) return;
        if (loadError instanceof AccountError && (loadError.status === 404 || loadError.status === 401)) {
          clearLastRunId();
          router.replace("/workspace/list");
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Could not load this analysis.");
      }
    }
    load();
    return () => { stopped = true; };
  }, [runId, router]);

  return <div className="pulse-app">
    <DashboardSidebar active="Summary" runId={runId}/>
    <div className="dashboard-shell">
      <main className="dashboard-content">
        <p className="eyebrow">MDS05 · EDUCATION / RESEARCH TRACK</p>
        <div className="page-head">
          <div>
            <h1>Research summary</h1>
            <p className="dashboard-subtitle">Start with the result, then open the analysis when you want to inspect the signal.</p>
          </div>
        </div>
        {resolving ? <div className="timeline-chart-empty">Loading your analysis…</div>
          : !runId && resolveError ? <div className="timeline-chart-empty"><p>{resolveError}</p><button type="button" onClick={retry} className="mt-6 bg-signal text-ink font-medium px-5 py-3 rounded-sm">RETRY</button></div>
          : !runId ? <NoAnalysisSelected />
          : error ? <p className="text-alert font-mono text-sm mt-4">{error}</p>
          : results?.result_summary ? <Mds05Summary summary={results.result_summary}/> : <div className="timeline-chart-empty">Preparing your research summary…</div>}
      </main>
    </div>
  </div>;
}

export default function WorkspaceSummaryPage() {
  return <main className="min-h-screen bg-ink"><Suspense fallback={null}><WorkspaceSummaryInner /></Suspense></main>;
}
