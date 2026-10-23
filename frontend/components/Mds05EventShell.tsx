import Link from "next/link";
import type { ReactNode } from "react";

export default function Mds05EventShell({ active, eyebrow, title, intro, children }: {
  active: "Overview" | "Findings" | "Evidence" | "Method" | "Limitations";
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  const links = [
    ["Overview", "/mds05"],
    ["Findings", "/mds05/findings"],
    ["Evidence", "/mds05/evidence"],
    ["Method", "/mds05/method"],
    ["Limitations", "/mds05/limits"],
  ] as const;
  return <main className="mds05-event">
    <header className="mds05-event-header">
      <Link href="/mds05" className="mds05-event-brand"><b>VL</b><span>VERDICTL<span>AB</span></span></Link>
      <nav aria-label="MDS05 event navigation">
        {links.map(([label, href]) => <Link key={label} className={active === label ? "active" : ""} href={href}>{label}</Link>)}
      </nav>
      <Link className="mds05-workspace-link" href="/workspace/access">Open workspace</Link>
    </header>
    <div className="mds05-event-body">
      <p className="mds05-event-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="mds05-event-intro">{intro}</p>
      {children}
    </div>
  </main>;
}

export function EventCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`mds05-event-card ${className}`}>{children}</section>;
}

export function EventButton({ href, children }: { href: string; children: ReactNode }) {
  return <Link className="mds05-event-button" href={href}>{children}</Link>;
}
