import Mds05EventShell, { EventButton, EventCard } from "@/components/Mds05EventShell";

export default function Mds05OverviewPage() {
  return <Mds05EventShell active="Overview" eyebrow="MDS05 · EDUCATION / RESEARCH TRACK" title="When sentiment tools disagree, what should researchers trust?" intro="We study the consistency of sentiment tools on large-scale public conversations about international conflict, then make disagreements traceable to the source text.">
    <section className="mds05-hero-finding">
      <span>MAIN FINDING</span>
      <h2>Automated tools can produce different interpretations of the same conflict language.</h2>
      <p>Our contribution is not a claim that SenticNet is always right. It is an auditable workflow that shows where tools disagree and where human review is needed.</p>
    </section>
    <div className="mds05-overview-stats">
      <div><b>6.50M</b><span>comments analysed</span><small>Reddit + Truth Social</small></div>
      <div><b>49.4%</b><span>model agreement</span><small>Reddit category match</small></div>
      <div><b>51.1%</b><span>VADER exact match</span><small>provided-label sample · n = 1,000</small></div>
      <div><b>36.8%</b><span>SenticNet exact match</span><small>provided-label sample · n = 1,000</small></div>
    </div>
    <div className="mds05-overview-columns">
      <EventCard><span className="mds05-card-kicker">WHAT WE STUDIED</span><h2>Public conversations about international conflict</h2><p>We scored 6.5 million Reddit and Truth Social comments collected across 38 months.</p><EventButton href="/mds05/method">See how it works →</EventButton></EventCard>
      <EventCard><span className="mds05-card-kicker">RESEARCH CONTRIBUTION</span><h2>A sentiment score is a signal, not a verdict</h2><p>VerdictLab combines interpretable comparison, disagreement detection, source-level evidence tracing, and responsible-use guidance in one workflow.</p><EventButton href="/mds05/evidence">Trace one example →</EventButton></EventCard>
    </div>
    <div className="mds05-two-column mds05-overview-callouts">
      <EventCard><span className="mds05-card-kicker">WHAT THE RESULT DOES PROVE</span><p>The tools produce different signals on this collected sample, and those differences can be investigated at source level.</p></EventCard>
      <EventCard><span className="mds05-card-kicker">WHAT IT DOES NOT PROVE</span><p>This is not a representative global-opinion survey, a diagnosis of individual emotion, or proof that either tool is always correct.</p></EventCard>
    </div>
    <p className="mds05-event-note">Start with <b>Findings</b> for the results, <b>Evidence</b> for a real example, or <b>Method</b> for the technical process.</p>
  </Mds05EventShell>;
}
