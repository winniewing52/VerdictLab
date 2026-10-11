"use client";
import Link from "next/link";
export default function DemoBadge() {
    return (<div className="demo-banner" role="status">
      <span className="demo-banner-label">SAMPLE ANALYSIS</span>
      <span className="demo-banner-source">Cached exploratory sample from r/IranWarReport · stored rows may be a sample of the source</span>
      <Link href="/" className="demo-banner-link">Exit demo</Link>
    </div>);
}
