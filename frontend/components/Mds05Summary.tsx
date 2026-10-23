import { MDS05_FINDINGS } from "@/lib/mds05Findings";
import type { AnalysisResults } from "@/lib/api";

function Mds05Bar({ label, value, width, tone }: {
  label: string;
  value: string;
  width: string;
  tone: "cyan" | "orange";
}) {
  return <div className="mds05-bar-row"><b>{label}</b><i><em className={`mds05-${tone}`} style={{ width }}/></i><strong className={`mds05-${tone}`}>{value}</strong></div>;
}

export default function Mds05Summary({ summary }: {
  summary: NonNullable<AnalysisResults["result_summary"]>;
}) {
  const benchmark = summary.trust_benchmark;
  const total = summary.total_records.toLocaleString();
  const breakdown = summary.sentiment_breakdown;
  const dominant = breakdown.negative >= breakdown.positive && breakdown.negative >= breakdown.neutral
    ? "negative"
    : breakdown.positive >= breakdown.neutral ? "positive" : "neutral";

  return <section className="mds05-judge-overview" aria-labelledby="mds05-overview-title">
    <div className="mds05-overview-intro">
      <div>
        <span className="mds05-finding-label">MDS05 · RESEARCH SUMMARY</span>
        <h2 id="mds05-overview-title">How reliable are sentiment tools on conflict language?</h2>
        <p>We compare sentiment signals on public conflict discussions. {benchmark ? "This run includes a labelled evaluation." : "This run is exploratory; published reference results are shown separately."} The goal is not to declare a winner—it is to show when automated sentiment needs human review.</p>
      </div>
      <div className="mds05-overview-actions">
        <a href="/demo/validation">REFERENCE RESULTS →</a>
        <a href="/methodology">METHOD →</a>
      </div>
    </div>
    <p className="mds05-overview-meta">{total} records scored · 2 methods compared · {benchmark ? `${benchmark.labelled_records.toLocaleString()} labelled examples` : `TweetEval reference: VADER ${MDS05_FINDINGS.tweetEvalVaderAccuracyPct}% · SenticNet ${MDS05_FINDINGS.tweetEvalSenticNetAccuracyPct}%`} · largest tone: <b>{dominant}</b></p>
    <div className="mds05-judge-grid">
      <article className="mds05-judge-card mds05-judge-card--finding">
        <span className="mds05-card-kicker">KEY FINDING</span>
        <h3>Automated tools do not always agree.</h3>
        {benchmark ? <>
          <div className="mds05-agreement-number">{benchmark.agreement_pct}%</div>
          <p>of the evaluated comments received the same positive, neutral, or negative category from SenticNet and VADER.</p>
          <small>Agreement is a useful signal to investigate—not proof that either tool is correct.</small>
        </> : <>
          <div className="mds05-agreement-number">Exploratory run</div>
          <p>This collected slice is presented for comparison and evidence tracing. Published benchmark results are shown separately.</p>
        </>}
      </article>
      <article className="mds05-judge-card">
        <span className="mds05-card-kicker">REFERENCE CHECK</span>
        <h3>{benchmark ? "How often did each tool match the labelled examples?" : "How do the tools perform on a published reference?"}</h3>
        {benchmark ? <>
          <div className="mds05-validation-bars">
            <Mds05Bar label="VADER" value={`${benchmark.accuracy_pct.vader}%`} width={`${Math.min(100, benchmark.accuracy_pct.vader * 1.5)}%`} tone="orange"/>
            <Mds05Bar label="SenticNet" value={`${benchmark.accuracy_pct.senticnet}%`} width={`${Math.min(100, benchmark.accuracy_pct.senticnet * 1.5)}%`} tone="cyan"/>
          </div>
          <p className="mds05-judge-note">Exact category match on {benchmark.labelled_records.toLocaleString()} human-labelled comments.</p>
        </> : <>
          <div className="mds05-validation-bars">
            <Mds05Bar label="VADER" value={`${MDS05_FINDINGS.tweetEvalVaderAccuracyPct}%`} width={`${MDS05_FINDINGS.tweetEvalVaderAccuracyPct}%`} tone="orange"/>
            <Mds05Bar label="SenticNet" value={`${MDS05_FINDINGS.tweetEvalSenticNetAccuracyPct}%`} width={`${MDS05_FINDINGS.tweetEvalSenticNetAccuracyPct}%`} tone="cyan"/>
          </div>
          <p className="mds05-judge-note">Official TweetEval sentiment test split · n = {MDS05_FINDINGS.tweetEvalRecords.toLocaleString()} · accuracy, not a global-opinion measure.</p>
        </>}
      </article>
    </div>
    <p className="mds05-scope-note">Scope: these results describe the collected online data, not every person’s opinion. SenticNet-derived affective dimensions elsewhere in the dashboard are exploratory and not human-validated.</p>
  </section>;
}
