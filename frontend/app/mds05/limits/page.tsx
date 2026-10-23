import Mds05EventShell, { EventCard } from "@/components/Mds05EventShell";

export default function Mds05LimitsPage() {
  return <Mds05EventShell active="Limitations" eyebrow="04 · LIMITATIONS" title="What can this system not tell us?" intro="A research result is stronger when its boundaries are explicit. VerdictLab shows patterns in collected online text; it does not claim to represent every person.">
    <div className="mds05-limit-grid">
      {[
        ["Sampling", "Online comments reflect the selected platforms, communities, time period, and collection method—not the entire global population."],
        ["Context", "Sarcasm, negation, slang, quotations, and missing conversation context can change a sentiment result."],
        ["Interpretation", "Negative sentiment is not the same as opposition, and a model-derived emotion dimension is not a human-validated emotion label."],
        ["Responsible use", "The system supports researchers by identifying patterns and review targets. It should not replace human judgement or be used as a definitive poll."],
      ].map(([title, text]) => <EventCard key={title}><span className="mds05-card-kicker">{title.toUpperCase()}</span><p>{text}</p></EventCard>)}
    </div>
  </Mds05EventShell>;
}
