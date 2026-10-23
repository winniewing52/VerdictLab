"use client";

import { useState } from "react";
import Link from "next/link";

const steps = [
  ["/demo", "Overview", "Start with the headline signal and the charts behind the real dashboard."],
  ["/demo/timeline", "Timeline", "See when the conversation changed, then select an event marker."],
  ["/demo/compare", "Compare", "Use the real comparison charts; the guide pauses briefly before moving on."],
  ["/demo/explorer", "Evidence", "Open the records behind the charts and inspect the source text."],
  ["/demo/live", "Live text", "Try a sentence of your own. This last step needs the analysis service."],
] as const;

export default function DemoGuidePage() {
  const [step, setStep] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const current = steps[step];
  function reset() { setStep(0); setSkipped(false); }
  return <div className="demo-guide-bar" data-guide-skipped={skipped || undefined}>
    <div><b>Guided demo</b><span> · Step {step + 1} of {steps.length} · {current[1]}</span><p>{current[2]}</p></div>
    <div className="demo-guide-actions">
      {step < steps.length - 1 ? <Link href={current[0]} onClick={() => setStep((value) => value + 1)}>Next →</Link> : <Link href={current[0]}>Try it →</Link>}
      <button type="button" onClick={reset}>Reset demo</button>
      <button type="button" onClick={() => setSkipped(true)}>Skip guide</button>
    </div>
  </div>;
}
