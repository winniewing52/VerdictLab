"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import DashboardSidebar from "@/components/DashboardSidebar";
import { evaluateSentiment, getAnalysis, getBenchmark, getResults, type AnalysisResults, type BenchmarkResult } from "@/lib/api";
import { useActiveRun } from "@/lib/useActiveRun";
import TrustPanel from "@/components/TrustPanel";

function metric(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export default function ValidationPage() {
  return <Suspense fallback={null}><ValidationPageInner /></Suspense>;
}

function ValidationPageInner() {
  const pathname = usePathname();
  const workspaceMode = pathname?.startsWith("/workspace") ?? false;
  const { runId } = useActiveRun();
  const [runSummary, setRunSummary] = useState<NonNullable<AnalysisResults["result_summary"]> | null>(null);
  const returnHref = workspaceMode ? "/workspace" : "/demo";
  const returnLabel = workspaceMode ? "Return to the workspace dashboard" : "Return to the sample analysis";
  const [benchmark, setBenchmark] = useState<BenchmarkResult | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState("");
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBenchmark()
      .then(setBenchmark)
      .catch(() => setError("The reproducible benchmark is not available yet."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!workspaceMode || !runId)
      return;
    getAnalysis(runId).then((analysis) => analysis.status === "complete" ? getResults(runId) : null)
      .then((results) => setRunSummary(results?.result_summary ?? null))
      .catch(() => setRunSummary(null));
  }, [runId, workspaceMode]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file || !datasetName.trim()) {
      setError("Choose a labelled CSV/XLSX file and name the dataset first.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      setResult(await evaluateSentiment({ file, datasetName: datasetName.trim() }));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The evaluation could not be completed.");
    } finally {
      setSubmitting(false);
    }

  }

  const displayed = result ?? benchmark;
  const benchmarkRecords = displayed?.dataset.records ?? 0;
  const strongestBaseline = displayed
    ? Object.entries(displayed.models).sort(([, left], [, right]) => right.macro_f1 - left.macro_f1)[0]
    : null;

  return (
    <div className="pulse-app">
      <DashboardSidebar active="Validation" runId={runId} />
      <main className="validation-page">
        <div className="validation-shell">
          <p className="eyebrow">05 · VALIDATION / EVIDENCE</p>
          <div className="validation-hero">
            <div>
              <h1>Can we trust the signal?</h1>
              <p>
                VerdictLab does not hide weak results behind attractive charts. This page separates
                measured model performance from exploratory insights and shows exactly what still needs
                human review.
              </p>
            </div>
            <span className="validation-stamp">NO FABRICATED SCORES</span>
          </div>

          {error && <p className="validation-error" role="alert">{error}</p>}

          {runSummary && <TrustPanel summary={runSummary} />}

          <section className="validation-card validation-card--primary" id="agreement">
            <div className="validation-section-head">
              <div>
                <p className="validation-kicker">01 · TECHNICAL VALIDATION</p>
                <h2>Measure performance, not confidence</h2>
                <p>Independent human labels are the reference point. Production records are never treated as ground truth.</p>
              </div>
              <span className="validation-status">{loading ? "LOADING" : displayed ? "MEASURED" : "AWAITING DATA"}</span>
            </div>
            {displayed ? (
              <div className="validation-model-grid">
                {Object.entries(displayed.models).map(([name, model]) => (
                  <article className="validation-model" key={name}>
                    <span>{name}</span>
                    <strong>{metric(model.macro_f1)}</strong>
                    <small>macro-F1 · accuracy {metric(model.accuracy)}</small>
                    <div className="validation-track"><i style={{ width: `${model.macro_f1 * 100}%` }} /></div>
                    <small>95% CI {metric(model.confidence_intervals_95.macro_f1[0])}–{metric(model.confidence_intervals_95.macro_f1[1])}</small>
                  </article>
                ))}
              </div>
            ) : (
              <p className="validation-empty">Run the benchmark script to create a committed result before making a performance claim.</p>
            )}
            {displayed && (
              <p className="validation-footnote">
                {benchmarkRecords.toLocaleString()} independently labelled records · macro-F1 is the headline comparison because it treats each class fairly.
              </p>
            )}
          </section>

          {displayed && strongestBaseline && (
            <section className="validation-card validation-card--interpretation" aria-labelledby="validation-interpretation-title">
              <div className="validation-section-head">
                <div>
                  <p className="validation-kicker">READ THIS BEFORE THE CHART</p>
                  <h2 id="validation-interpretation-title">What this evidence does—and does not—say</h2>
                </div>
                <span className="validation-status">HONEST RESULT</span>
              </div>
              <div className="validation-interpretation-grid">
                <div>
                  <strong>Measured</strong>
                  <p>
                    On this labelled TweetEval test split, <b>{strongestBaseline[0]}</b> is the strongest
                    baseline by macro-F1 at {metric(strongestBaseline[1].macro_f1)}. This is a real limitation
                    of the current sentiment benchmark, not a score VerdictLab hides.
                  </p>
                </div>
                <div>
                  <strong>VerdictLab&apos;s contribution</strong>
                  <p>
                    VerdictLab is designed as an evidence-tracing decision-support layer: it surfaces changes,
                    disagreement, emotional dimensions, and representative records for human review. Those
                    benefits must not be described as higher classification accuracy.
                  </p>
                </div>
                <div>
                  <strong>Still required</strong>
                  <p>
                    Human usability and explanation studies are needed before claiming that the interface
                    improves decisions. Until then, treat the dashboard as an exploratory signal—not a
                    measurement of what the whole public believes.
                  </p>
                </div>
              </div>
            </section>
          )}

          <div className="validation-columns">
            <section className="validation-card">
              <p className="validation-kicker">02 · YOUR DATASET</p>
              <h2>Run a reproducible evaluation</h2>
              <p>Upload at least 100 rows with a text column and a human label column. The evaluator returns accuracy, macro-F1, per-class scores, confusion matrices, confidence intervals, and predefined error slices.</p>
              <form className="validation-form" onSubmit={submit}>
                <label>Dataset name<input value={datasetName} onChange={(event) => setDatasetName(event.target.value)} placeholder="e.g. student feedback test split" /></label>
                <label>Labelled CSV / XLSX<input type="file" accept=".csv,.xls,.xlsx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
                <button type="submit" disabled={submitting}>{submitting ? "Evaluating…" : "Evaluate dataset →"}</button>
              </form>
              <p className="validation-note">Sign in is required for uploaded evaluations. The public benchmark above remains available for demonstration.</p>
            </section>
            <section className="validation-card">
              <p className="validation-kicker">03 · HUMAN VALIDATION</p>
              <h2>Numbers are not the whole proof</h2>
              <ul className="validation-list">
                <li><b>Annotator agreement</b><span>Use 2+ independent labels per item and report Cohen&apos;s κ or Krippendorff&apos;s α.</span></li>
                <li><b>Human ↔ system agreement</b><span>Measure whether explanations change a participant&apos;s interpretation.</span></li>
                <li><b>Usability evidence</b><span>Report task completion, time-to-understanding, mistakes, and before/after decisions.</span></li>
              </ul>
            </section>
          </div>

          <section className="validation-next">
            <div>
              <p className="validation-kicker">THE RESPONSIBLE CONCLUSION</p>
              <h2>Accuracy is one question. Defensibility is the product.</h2>
              <p>Use the dashboard to find what deserves attention, then inspect the evidence before acting. No sentiment score can prove what the whole public believes.</p>
            </div>
            <Link href={returnHref}>{returnLabel} →</Link>
          </section>
        </div>
      </main>
    </div>
  );
}
