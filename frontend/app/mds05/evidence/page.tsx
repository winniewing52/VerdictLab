import Mds05EventShell, { EventButton, EventCard } from "@/components/Mds05EventShell";

export default function Mds05EvidencePage() {
  return <Mds05EventShell active="Evidence" eyebrow="02 · EVIDENCE" title="Can we trace a score back to the text?" intro="Yes. The dashboard keeps the original language and both model outputs visible so a researcher can inspect the disagreement.">
    <div className="mds05-evidence-flow">
      <EventCard><span className="mds05-card-kicker">01 · SOURCE COMMENT</span><h2>Read the original language</h2><blockquote>“Stop the war, too many innocent people are dying.”</blockquote><p className="mds05-muted">A human reader can recognise concern and grief in the sentence. Automated tools may interpret the same words differently.</p></EventCard>
      <div className="mds05-flow-arrow">→</div>
      <EventCard><span className="mds05-card-kicker">02 · TWO SIGNALS</span><h2>Compare the outputs</h2><div className="mds05-score-pills"><b>SenticNet +0.541</b><b>VADER −0.570</b></div><p className="mds05-muted">The polarity directions are opposite. This is exactly the kind of case that should not be hidden inside an average.</p></EventCard>
    </div>
    <EventCard className="mds05-interpretation"><span className="mds05-card-kicker">03 · HUMAN CHECK</span><h2>Inspect context before making a claim</h2><p>VerdictLab links aggregate charts to source records so researchers can check whether a result is supported, ambiguous, or affected by model limitations.</p><EventButton href="/workspace/explorer">Open the full evidence explorer →</EventButton></EventCard>
  </Mds05EventShell>;
}
