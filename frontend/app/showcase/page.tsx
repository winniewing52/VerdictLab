"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { MDS05_FINDINGS } from "@/lib/mds05Findings";

const SCENE_DURATION_MS = 4000;

const scenes = [
  {
    kicker: "01 · THE PROBLEM",
    title: "Public conversations are changing fast.",
    text: `About ${(MDS05_FINDINGS.datasetRecords / 1000000).toFixed(1)} million public comments give researchers a lot to read—but important shifts are easy to miss.`,
    visual: "flow",
  },
  {
    kicker: "02 · THE CHALLENGE",
    title: "One score is not the whole story.",
    text: "“Stop the war, too many innocent people are dying.” SenticNet reads it as +0.541; VADER reads it as −0.570.",
    visual: "quote",
  },
  {
    kicker: "03 · THE SOLUTION",
    title: "VerdictLab turns conversation into evidence.",
    text: "It shows the signal, the change, and the source records behind every number.",
    visual: "pipeline",
  },
  {
    kicker: "04 · HOW IT WORKS",
    title: "We collect, score, compare, and trace.",
    text: "SenticNet, VADER, and TextBlob provide different views of the same public language.",
    visual: "trace",
  },
  {
    kicker: "05 · KEY FINDING",
    title: "The tools agreed on only 49.4% of Reddit comments.",
    text: "Disagreement is not failure. It tells researchers where human review matters most.",
    visual: "agreement",
  },
  {
    kicker: "06 · TRACEABILITY",
    title: "Every finding can lead back to the words.",
    text: "Open a chart point, inspect the original record, and compare the model outputs.",
    visual: "record",
  },
  {
    kicker: "07 · IMPACT",
    title: "Better evidence leads to better questions.",
    text: "VerdictLab helps researchers, students, and analysts find where human review is needed instead of trusting one score.",
    visual: "impact",
  },
] as const;

function Visual({ type }: { type: (typeof scenes)[number]["visual"] }) {
  if (type === "flow") {
    return <div className="showcase-flow" aria-label="Public comments become research signals">
      {["Public language", "Patterns", "Questions", "Human review"].map((label, index) => <div key={label}><span>0{index + 1}</span><b>{label}</b></div>)}
    </div>;
  }
  if (type === "quote") {
    return <blockquote className="showcase-quote">“Stop the war, too many innocent people are dying.”<cite>One source comment · two model readings</cite></blockquote>;
  }
  if (type === "pipeline") {
    return <div className="showcase-flow" aria-label="VerdictLab evidence pipeline">
      {["Records", "Signals", "Findings", "Evidence"].map((label, index) => <div key={label}><span>STEP 0{index + 1}</span><b>{label}</b></div>)}
    </div>;
  }
  if (type === "trace") {
    return <div className="showcase-trace" aria-label="VerdictLab analysis steps">
      {["Collect public text", "Score with different tools", "Compare the signals", "Inspect the source record"].map((label) => <div key={label}><span>{label}</span><b>→</b></div>)}
    </div>;
  }
  if (type === "agreement") {
    return <div className="showcase-metric" aria-label="49.4 percent model agreement">
      <strong>{MDS05_FINDINGS.modelAgreementPct}%</strong>
      <p>of Reddit comments received the same positive, neutral, or negative category from SenticNet and VADER.</p>
      <div className="showcase-bars">
        <div className="showcase-bar-row"><b>AGREEMENT</b><span className="showcase-bar-track"><i style={{ width: `${MDS05_FINDINGS.modelAgreementPct}%` }} /></span><strong>{MDS05_FINDINGS.modelAgreementPct}%</strong></div>
        <div className="showcase-bar-row"><b>VADER / HUMANS</b><span className="showcase-bar-track"><i style={{ width: `${MDS05_FINDINGS.vaderHumanMatchPct}%` }} /></span><strong>{MDS05_FINDINGS.vaderHumanMatchPct}%</strong></div>
        <div className="showcase-bar-row"><b>SENTICNET / HUMANS</b><span className="showcase-bar-track"><i style={{ width: `${MDS05_FINDINGS.senticNetHumanMatchPct}%` }} /></span><strong>{MDS05_FINDINGS.senticNetHumanMatchPct}%</strong></div>
      </div>
    </div>;
  }
  if (type === "record") {
    return <div className="showcase-trace" aria-label="Traceability path">
      {["Chart point", "Source comment", "SenticNet +0.541", "VADER −0.570"].map((label) => <div key={label}><span>{label}</span><b>{label.includes("+") || label.includes("−") ? "score" : "→"}</b></div>)}
    </div>;
  }
  return <div className="showcase-impact">
    <div><b>Researchers</b><span>Find patterns worth investigating.</span></div>
    <div><b>Students</b><span>Learn how evidence and model limits fit together.</span></div>
    <div><b>Analysts</b><span>Focus human review where one score is not enough.</span></div>
    <div><b>Team MDS05</b><span>Winnie Ng · Abdul Rashid · Najah Tasfia Zumana · Hassan Hashmi<br />Supervisor: Dr. Ganesh Krishnasamy</span></div>
  </div>;
}

export default function ShowcasePage() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const scene = scenes[sceneIndex];

  const nextScene = useCallback(() => setSceneIndex((current) => (current + 1) % scenes.length), []);
  const previousScene = useCallback(() => setSceneIndex((current) => (current - 1 + scenes.length) % scenes.length), []);

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const timer = window.setInterval(nextScene, SCENE_DURATION_MS);
    return () => window.clearInterval(timer);
  }, [nextScene, paused]);

  useEffect(() => {
    const configuredOrigin = (process.env.NEXT_PUBLIC_SHARE_ORIGIN ?? process.env.NEXT_PUBLIC_SHARE_HOST)?.replace(/\/$/, "");
    setShareUrl(`${configuredOrigin || window.location.origin}/demo`);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === " ") {
        event.preventDefault();
        setPaused((current) => !current);
      }
      else if (event.key === "ArrowRight") {
        event.preventDefault();
        nextScene();
      }
      else if (event.key === "ArrowLeft") {
        event.preventDefault();
        previousScene();
      }
      else if (event.key === "Home") {
        event.preventDefault();
        setSceneIndex(0);
      }
      else if (event.key === "End") {
        event.preventDefault();
        setSceneIndex(scenes.length - 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nextScene, previousScene]);

  return <main className="showcase-page">
    <div className="showcase-shell">
      <header className="showcase-header">
        <Link className="showcase-brand" href="/"><b>VL</b><span>VerdictLab · MDS05</span></Link>
        <div className="showcase-header-meta"><span>Education / Research</span></div>
      </header>

      <section className="showcase-stage" aria-live="polite" aria-label={`Showcase scene ${sceneIndex + 1} of ${scenes.length}`}>
        <article className="showcase-scene" key={sceneIndex}>
          <div className="showcase-copy">
            <p className="showcase-kicker">{scene.kicker}</p>
            <h1>{scene.title}</h1>
            <p>{scene.text}</p>
          </div>
          <div className="showcase-visual"><Visual type={scene.visual} /></div>
        </article>
      </section>

      <footer className="showcase-footer">
        <div className="showcase-progress" aria-label="Choose a showcase scene">
          {scenes.map((item, index) => <button key={item.kicker} type="button" aria-label={`Go to scene ${index + 1}`} aria-current={sceneIndex === index ? "true" : undefined} onClick={() => { setSceneIndex(index); setPaused(true); }} />)}
        </div>
        <span className="showcase-source">MDS05 findings · 1,000 supplied-label examples · pre-computed snapshot</span>
        <div className="showcase-controls">
          <button type="button" onClick={previousScene} aria-label="Previous scene">← Prev</button>
          <button type="button" onClick={() => setPaused((current) => !current)}>{paused ? "Play" : "Pause"}</button>
          <button type="button" onClick={nextScene} aria-label="Next scene">Next →</button>
          <button type="button" className="showcase-share" onClick={() => setShareOpen((current) => !current)}>Share</button>
        </div>
      </footer>

      {shareOpen && <div className="showcase-share-panel" role="dialog" aria-label="Share the VerdictLab demo">
        <button type="button" onClick={() => setShareOpen(false)} aria-label="Close share panel">×</button>
        <div>{shareUrl && <QRCodeSVG value={shareUrl} size={150} bgColor="#ffffff" fgColor="#080b0e" level="M" includeMargin />}</div>
        <p>Scan to open the interactive demo. It works when your phone can reach this laptop or the configured share host.</p>
        <p>This QR code opens the demo when your phone is on the same network as this computer.</p>
        <code>{shareUrl || "Share link unavailable"}</code>
      </div>}
    </div>
  </main>;
}
