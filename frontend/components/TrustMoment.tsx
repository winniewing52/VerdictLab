"use client";
import { useEffect, useState } from "react";
import { analyseLive, type LiveResult } from "@/lib/api";
type TrustMomentProps = {
    compact?: boolean;
};
export default function TrustMoment({ compact = false }: TrustMomentProps) {
    const [sarcasm, setSarcasm] = useState(false);
    const [text, setText] = useState("Great. Another update that makes everything worse.");
    const [result, setResult] = useState<LiveResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        if (!sarcasm || !text.trim()) {
            setResult(null);
            setError(null);
            return;
        }
        const controller = new AbortController();
        setLoading(true);
        analyseLive(text.trim(), controller.signal)
            .then(setResult)
            .catch((reason) => {
            if (!(reason instanceof DOMException && reason.name === "AbortError")) {
                setError(reason instanceof Error ? reason.message : "Could not analyse this text.");
            }
        })
            .finally(() => setLoading(false));
        return () => controller.abort();
    }, [sarcasm, text]);
    const score = result?.senticnet ?? result?.vader ?? 0;
    const signedScore = `${score >= 0 ? "+" : ""}${score.toFixed(2)}`;
    return (<section className={`trust-moment${compact ? " trust-moment-compact" : ""}`} aria-labelledby="trust-moment-title">
      <div className="trust-moment-head">
        <div>
          <p className="trust-kicker">THE TRUST MOMENT</p>
          <h2 id="trust-moment-title">A useful model knows when it can be wrong.</h2>
          <p className="trust-lede">
            VerdictLab does not turn a score into a fact. It makes the evidence, the uncertainty and the human context visible.
          </p>
        </div>
      </div>

      <div className="trust-grid">
        <article className="trust-card trust-sarcasm-card">
          <div className="trust-card-top">
            <span className="trust-index">01</span>
            <span className="trust-status">LIVE TEST</span>
          </div>
          <h3>Can the model hear sarcasm?</h3>
          <label htmlFor="landing-live-test" className="trust-example">
            Test any sentence:
          </label>
          <textarea id="landing-live-test" value={text} onChange={(event) => setText(event.target.value.slice(0, 2000))} rows={2} className="trust-example w-full resize-y border border-line bg-ink p-2 text-left" aria-label="Text to analyse"/>
          <button type="button" className="trust-action" onClick={() => setSarcasm((current) => !current)}>
            {sarcasm ? "RESET THE TEST" : "RUN THE TEST"}
          </button>
          <div className={`sarcasm-result${sarcasm ? " is-visible" : ""}`} aria-live="polite">
            {loading ? (<p>Running the live analyser…</p>) : error ? (<p className="trust-negative">{error}</p>) : result ? (<>
                <div>
                  <span>MODEL READS</span>
                  <strong className={result.label === "positive" ? "trust-positive" : "trust-negative"}>
                    {result.label} · {signedScore}
                  </strong>
                </div>
                <p>The score comes from the same live analyser used in the workspace. Try changing the sentence and run it again.</p>
              </>) : (<p>Enter a sentence and run the live test.</p>)}
          </div>
        </article>

        <article className="trust-card trust-event-card">
          <div className="trust-card-top">
            <span className="trust-index">02</span>
            <span className="trust-status">CONTEXT, NOT CAUSATION</span>
          </div>
          <h3>A real event can change the mood in a day.</h3>
          <div className="trust-event-chart" role="img" aria-label="Illustrative sentiment drop after the 24 February 2022 invasion of Ukraine">
            <div className="trust-event-zero"/>
            <div className="trust-event-line"/>
            <span className="trust-event-dot trust-event-before"/>
            <span className="trust-event-dot trust-event-after"/>
            <span className="trust-event-label trust-event-label-before">+0.18</span>
            <span className="trust-event-label trust-event-label-after">−0.41</span>
            <span className="trust-event-date">24 FEB 2022</span>
          </div>
          <p className="trust-event-caption">
            <b>Russia&apos;s full-scale invasion of Ukraine</b> — a true historical event marker beside an illustrative sentiment shift.
          </p>
          <p className="trust-footnote">Use the marker to ask better questions; it does not prove the event caused the change.</p>
        </article>
      </div>

      {!compact && (<div className="trust-bottom-grid">
          <article className="trust-story-card">
            <p className="trust-kicker">WHO BENEFITS</p>
            <h3>One dataset. Two useful decisions.</h3>
            <div className="trust-persona">
              <span className="trust-avatar">J</span>
              <p><b>Jaya, journalist</b><br />Finds the turning point, opens the source comments, and writes with evidence instead of vibes.</p>
            </div>
            <div className="trust-persona">
              <span className="trust-avatar">A</span>
              <p><b>Alex, analyst</b><br />Compares communities, spots a trust problem, and knows what needs a human read next.</p>
            </div>
          </article>
          <article className="trust-limits-card">
            <p className="trust-kicker">BOUNDARIES ARE A FEATURE</p>
            <h3>What this dashboard cannot know</h3>
            <ul>
              <li>Text is anonymised; Reddit users are not a representative population.</li>
              <li>English-only scoring can miss culture, slang and context.</li>
              <li>Bias, irony and coordinated activity can distort a signal.</li>
            </ul>
          </article>
        </div>)}
    </section>);
}
