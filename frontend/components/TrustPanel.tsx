"use client";
import type { AnalysisResults } from "@/lib/api";
type TrustPanelProps = {
    summary: NonNullable<AnalysisResults["result_summary"]>;
};
const MODEL_LABELS = [
    { key: "senticnet", label: "SenticNet", color: "#f0ae2a" },
    { key: "vader", label: "VADER", color: "#08afd4" },
    { key: "textblob", label: "TextBlob", color: "#43ba88" },
] as const;
export default function TrustPanel({ summary }: TrustPanelProps) {
    const benchmark = summary.trust_benchmark;
    const scoring = summary.scoring;
    if (!scoring)
        return null;
    return (<section className="trust-panel" aria-labelledby="trust-title">
      <div className="trust-heading">
        <div>
          <p className="trust-eyebrow">MODEL HONESTY CHECK</p>
          <h2 id="trust-title">Trust, with the misses left in</h2>
          <p className="trust-intro">
            This run has no independently labelled evaluation set. Accuracy, precision, recall and
            F1 must be reported from the evaluation endpoint using a held-out labelled dataset.
          </p>
        </div>
        <span className="trust-badge">EVALUATION REQUIRED</span>
      </div>

      <div className="trust-grid">
        <div className="trust-card">
          <p className="trust-card-label">AGAINST HUMAN LABELS</p>
          <div className="trust-models">
            {benchmark ? MODEL_LABELS.map((model) => (<div className="trust-model" key={model.key}>
                <div className="trust-model-top">
                  <span><i style={{ background: model.color }}/>{model.label}</span>
                  <b>{benchmark.accuracy_pct[model.key]}%</b>
                </div>
                <div className="trust-track"><i style={{ width: `${benchmark.accuracy_pct[model.key]}%`, background: model.color }}/></div>
              </div>)) : <p className="trust-note">No score shown. The former eight-sentence sanity check was removed because it is not evidence.</p>}
          </div>
          <p className="trust-note">Use the labelled-dataset evaluator for per-class precision, recall, F1 and a confusion matrix.</p>
        </div>

        <div className="trust-card">
          <p className="trust-card-label">THIS RUN · SENTICNET REACH</p>
          <div className="trust-stat-row">
            <strong>{scoring.senticnet_usable_pct}%</strong>
            <span>used as the headline score</span>
          </div>
          <div className="trust-stat-row">
            <strong>{scoring.mean_concept_coverage_pct}%</strong>
            <span>mean concept coverage</span>
          </div>
          <p className="trust-note">
            Below {scoring.min_coverage_threshold_pct}% coverage, we show VADER fallback instead of pretending SenticNet understood the text.
          </p>
        </div>

        <div className="trust-card trust-sarcasm">
          <p className="trust-card-label">KNOWN FAILURE · SARCASM</p>
          <blockquote>Hourglass dimensions are exploratory until validated against independent human emotion labels.</blockquote>
          <div className="trust-sarcasm-row">
            <span>Validation status: <b>not configured</b></span>
          </div>
          <p className="trust-note">Upload 100+ independently labelled records before making academic accuracy claims.</p>
        </div>
      </div>
    </section>);
}
