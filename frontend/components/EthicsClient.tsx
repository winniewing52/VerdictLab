"use client";

import { useState } from "react";
import type { EthicsData } from "@/lib/ethics";
import DashboardSidebar from "@/components/DashboardSidebar";

type Props = { data: EthicsData };

export default function EthicsClient({ data }: Props) {
  const [activeScenario, setActiveScenario] = useState(0);
  const [showRedacted, setShowRedacted] = useState(false);
  const scenario = data.responsibleUse.scenarios[activeScenario];

  return (
    <main className="methodology-with-sidebar">
      <DashboardSidebar active="Ethics & Limits" />
      <div className="ethics-page">
        <div className="ethics-shell">
        <section className="ethics-hero">
          <div>
            <p className="ethics-eyebrow">■ {data.eyebrow}</p>
            <h1>{data.title[0]}</h1>
            <h2>{data.title[1]}</h2>
            <p className="ethics-intro">{data.intro}</p>
          </div>
          <a className="ethics-hero-action" href="#responsible-use">
            <span>{data.heroAction.label} <b>↓</b></span>
            <small>{data.heroAction.caption}</small>
          </a>
        </section>

        <section className="ethics-principles" aria-label="Ethics principles">
          {data.principles.map((principle) => (
            <article key={principle.title}>
              <span className="ethics-symbol" aria-hidden="true">{principle.icon}</span>
              <div><h3>{principle.title}</h3><p>{principle.description}</p></div>
            </article>
          ))}
        </section>

        <section className="ethics-section responsible-section" id="responsible-use">
          <div className="ethics-section-heading">
            <div><p className="ethics-eyebrow">■ {data.responsibleUse.eyebrow}</p><h2>{data.responsibleUse.title}</h2></div>
            <span className="ethics-outline-label">{data.responsibleUse.label}</span>
          </div>
          <div className="scenario-layout">
            <div className="scenario-list" role="tablist" aria-label="Responsible use scenarios">
              {data.responsibleUse.scenarios.map((item, index) => (
                <button key={item.title} className={index === activeScenario ? "scenario-tab active" : "scenario-tab"} onClick={() => setActiveScenario(index)} role="tab" aria-selected={index === activeScenario}>
                  <span>{item.number}</span><strong>{item.title}</strong><b>→</b>
                </button>
              ))}
            </div>
            <article className={`scenario-detail ${scenario.statusTone}`}>
              <p className="scenario-status">♧ &nbsp;{scenario.status}</p>
              <h3>{scenario.title}</h3>
              <p className="scenario-description">{scenario.description}</p>
              <div className="scenario-boundary"><small>The boundary</small><p>{scenario.boundary}</p></div>
              <div className="scenario-next"><small>Responsible next step</small><p>{scenario.nextStep}</p></div>
            </article>
          </div>
        </section>

        <section className="ethics-section privacy-section">
          <div className="ethics-section-heading">
            <div><p className="ethics-eyebrow">■ {data.privacy.eyebrow}</p><h2>{data.privacy.title}</h2></div>
            <p className="ethics-side-note">{data.privacy.sideNote}</p>
          </div>
          <div className="privacy-layout">
            <div className="privacy-copy"><h3>{data.privacy.subheading}</h3><p>{data.privacy.description}</p><ul>{data.privacy.guidance.map((item) => <li key={item}>{item}</li>)}</ul><small>{data.privacy.footnote}</small></div>
            <article className="record-card">
              <div className="record-card-header"><span>{data.privacy.recordLabel}</span><span aria-hidden="true">♧</span></div>
              <div className="record-toggle"><button className={!showRedacted ? "active" : ""} onClick={() => setShowRedacted(false)} aria-pressed={!showRedacted}>Original</button><button className={showRedacted ? "active" : ""} onClick={() => setShowRedacted(true)} aria-pressed={showRedacted}>Redacted example {showRedacted && "✓"}</button></div>
              <p className="record-text">{showRedacted ? data.privacy.redacted : data.privacy.original}</p>
              <p className="record-warning"><span>△</span>{data.privacy.warning}</p>
            </article>
          </div>
        </section>

        <section className="ethics-section boundaries-section">
          <div className="ethics-section-heading"><div><p className="ethics-eyebrow">■ {data.boundaries.eyebrow}</p><h2>{data.boundaries.title}</h2></div><p className="ethics-side-note">{data.boundaries.sideNote}</p></div>
          <div className="boundaries-grid">{data.boundaries.items.map((item) => <article key={item.number}><header><span>{item.number}</span><h3>{item.title}</h3><b>×</b></header><small>Why it matters</small><p>{item.why}</p><small>What to do</small><p>{item.action}</p></article>)}</div>
        </section>
        </div>
      </div>
    </main>
  );
}
