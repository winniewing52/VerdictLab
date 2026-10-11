"use client";

import { useState } from "react";
import MethodologyNavbar from "@/components/MethodologyNavbar";
import DashboardSidebar from "@/components/DashboardSidebar";
import type { MethodologyData } from "@/lib/methodology";

type Props = { data: MethodologyData };

function Icon({ name }: { name: string }) {
  return <span className="method-icon" aria-hidden="true">{name === "layers" ? "▱" : name === "privacy" || name === "shield" ? "♢" : name === "cross-check" ? "⌘" : name === "evidence" ? "▤" : name === "database" ? "▥" : name === "scan" ? "⌗" : name === "spark" ? "✧" : "✦"}</span>;
}

export default function MethodologyClient({ data }: Props) {
  const [activeStage, setActiveStage] = useState(0);
  const [activeExample, setActiveExample] = useState(0);
  const [openModel, setOpenModel] = useState<number | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const example = data.examples[activeExample];
  const stage = data.stages[activeStage];

  return (
    <main className="methodology-with-sidebar">
      <DashboardSidebar active="Methodology" />
      <div className="methodology-page">
        <MethodologyNavbar />
        <div className="methodology-shell">
        <div className="method-breadcrumb"><a href="/">VerdictLab</a><span>›</span><strong>Methodology</strong></div>
        <section className="method-hero">
          <div>
            <p className="method-eyebrow">■ {data.eyebrow}</p>
            <h1>{data.title[0]}<br /><span>{data.title[1]}</span></h1>
            <p className="method-lede">{data.intro}</p>
          </div>
          <div className="method-hero-action"><a className="method-button" href="#process">Explore the pipeline <span>↓</span></a><small>OPEN METHODS. HONEST LIMITS.</small></div>
        </section>
        <section className="principles-grid">{data.principles.map((item) => <article className="principle" key={item.title}><Icon name={item.icon} /><div><h3>{item.title}</h3><p>{item.description}</p></div></article>)}</section>

        <section className="method-section" id="process">
          <div className="section-heading"><div><p className="method-eyebrow">■ 01 / THE PROCESS</p><h2>From conversation to verdict.</h2></div><p>Every stage has a purpose.<br />Every result should have a trail.</p></div>
          <div className="stage-tabs">{data.stages.map((item, index) => <button className={index === activeStage ? "stage-tab active" : "stage-tab"} onClick={() => setActiveStage(index)} key={item.number}><Icon name={item.icon} /><span className="stage-number">{item.number}</span><strong>{item.title}</strong><small>{item.description}</small></button>)}</div>
          <div className="stage-detail"><div><h3>{stage.detailTitle}</h3><p>{stage.detail}</p></div><dl><div><dt>INPUT</dt><dd>{stage.input}</dd></div><div><dt>OUTPUT</dt><dd>{stage.output}</dd></div></dl></div>
        </section>

        <section className="method-section model-lab" id="model-lab">
          <div className="section-heading"><div><p className="method-eyebrow">■ 02 / THE MODEL LAB</p><h2>Same words. Different readings.</h2></div><span className="outlined-label">ILLUSTRATIVE EXAMPLES</span></div>
          <div className="example-layout"><div className="example-copy"><p>Sentiment is not always straightforward. Compare how three approaches can read a clear opinion—and why sarcasm needs a closer look.</p><div className="example-tabs">{data.examples.map((item, index) => <button className={index === activeExample ? "active" : ""} onClick={() => setActiveExample(index)} key={item.label}>{item.label}{index === activeExample && <span>✓</span>}</button>)}</div><blockquote>{example.quote}</blockquote><small>{example.note}<br />Scores are illustrative, not measured model outputs.</small></div><div className="score-card"><div className="score-card-head"><span>POLARITY COMPARISON</span><span>−1 TO +1</span></div>{example.scores.map((score) => <div className="score-row" key={score.model}><div><strong>{score.model}</strong><b>{score.value > 0 ? "+" : ""}{score.value.toFixed(2)}</b></div><div className="score-track"><span style={{ width: `${Math.abs(score.value) * 100}%` }} /></div><small>{score.description}</small></div>)}<p className="score-callout"><Icon name="cross-check" />{example.callout}</p></div></div>
        </section>

        <section className="method-section" id="models">
          <div className="section-heading"><div><p className="method-eyebrow">■ 03 / UNDER THE HOOD</p><h2>Different strengths. Shared scrutiny.</h2></div><p>Three perspectives—not three votes.<br />No single model has the final truth.</p></div>
          <div className="model-grid">{data.models.map((model, index) => <article className="model-card" key={model.name}><div className="model-card-top"><Icon name={model.icon} /><span>{model.type}</span></div><h3>{model.name}</h3><p>{model.description}</p><hr /><button className="model-disclosure" aria-expanded={openModel === index} onClick={() => setOpenModel(openModel === index ? null : index)}><span>{openModel === index ? "▼" : "▶"} Strengths &amp; limitations</span></button>{openModel === index && <div className="model-limitations"><p>{model.limitation}</p><a href={model.source} target="_blank" rel="noreferrer">Read the source ↗</a></div>}</article>)}</div>
        </section>

        <section className="method-section trust-section" id="trust">
          <div className="section-heading"><div><p className="method-eyebrow">■ 04 / TRUST &amp; TRANSPARENCY</p><h2>Useful insights. Honest boundaries.</h2></div><p>Knowing what a method cannot tell you<br />is part of understanding what it can.</p></div>
          <div className="trust-grid"><div className="trust-points">{data.trustPoints.map((item) => <article key={item.title}><Icon name="shield" /><div><h3>{item.title}</h3><p>{item.description}</p></div></article>)}</div><div className="faq-list">{data.faqs.map((item, index) => <article className={openFaq === index ? "faq open" : "faq"} key={item.question}><button aria-expanded={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? null : index)}><span>{item.question}</span><span aria-hidden="true">{openFaq === index ? "×" : "+"}</span></button>{openFaq === index && <p>{item.answer}</p>}</article>)}</div></div>
        </section>

        <section className="method-download"><div><h2>The method should travel with the verdict.</h2><p>Keep the process, limitations, and original model references in one place.</p></div><button onClick={() => window.print()}>⇩ &nbsp; Download methodology</button></section>
        <footer className="method-footer"><span>VERDICTLAB / EVIDENCE OVER ASSUMPTIONS</span><a href="#">Back to top&nbsp; →</a></footer>
        </div>
      </div>
    </main>
  );
}
