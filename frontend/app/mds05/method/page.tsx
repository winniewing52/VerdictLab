import Mds05EventShell, { EventCard } from "@/components/Mds05EventShell";

export default function Mds05MethodPage() {
  return <Mds05EventShell active="Method" eyebrow="03 · METHOD" title="How was the analysis performed?" intro="The workflow combines large-scale data processing, two sentiment methods, a labelled evaluation sample, and a published reference benchmark.">
    <div className="mds05-method-flow">{["Collect comments", "Clean and deduplicate", "Score with SenticNet and VADER", "Compare categories and trends", "Check against human labels"].map((step, index) => <div key={step}><span>0{index + 1}</span><b>{step}</b>{index < 4 && <i>→</i>}</div>)}</div>
    <div className="mds05-two-column">
      <EventCard><span className="mds05-card-kicker">DATA</span><h2>What was analysed?</h2><ul><li>6,496,344 public comments</li><li>Reddit and Truth Social</li><li>38 months of collected Reddit data</li><li>1,000 supplied-label evaluation examples</li><li>12,284 records in the official TweetEval test split</li></ul></EventCard>
      <EventCard><span className="mds05-card-kicker">COMPARISON</span><h2>What was measured?</h2><ul><li>Agreement between SenticNet and VADER</li><li>Exact category match on the evaluation sample</li><li>Accuracy, macro-F1, and bootstrap confidence intervals on TweetEval</li><li>Differences across platforms and time</li><li>Examples where the tools disagree</li></ul></EventCard>
    </div>
    <EventCard className="mds05-method-note"><span className="mds05-card-kicker">INTERPRETATION RULE</span><p>We report the collected sample and benchmark results separately. The source and annotation protocol for the 1,000 supplied-label records must be documented before treating them as independent human validation. Neither dataset establishes cause and effect or proves that online discussion represents the entire global population. SenticNet-derived affective dimensions are exploratory indicators, not validated emotion labels.</p></EventCard>
    <p className="mds05-event-note">The detailed interactive workspace remains available for judges who want to inspect filters, charts, and individual records.</p>
  </Mds05EventShell>;
}
