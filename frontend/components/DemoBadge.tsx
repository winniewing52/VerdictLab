"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getDemoSample } from "@/lib/api";
export default function DemoBadge() {
    const [sourceUrl, setSourceUrl] = useState<string | null>(null);
    const [sourceChecked, setSourceChecked] = useState(false);
    useEffect(() => {
        getDemoSample()
            .then((sample) => setSourceUrl(sample.source_url))
            .catch(() => setSourceUrl(null))
            .finally(() => setSourceChecked(true));
    }, []);
    const synthetic = sourceUrl?.startsWith("demo://") ?? false;
    const community = sourceUrl?.match(/reddit\.com\/r\/([^/]+)/i)?.[1];
    const description = !sourceChecked
        ? "Checking sample provenance…"
        : synthetic
            ? "Synthetic comments written for this demo about a made-up city policy. Not real users' posts."
            : `Cached exploratory sample${community ? ` from r/${community}` : ""} · stored rows may be a sample of the source`;
    return (<div className="demo-banner" role="status">
      <span className="demo-banner-label">{!sourceChecked ? "CHECKING PROVENANCE" : synthetic ? "SYNTHETIC DEMO" : "CACHED SAMPLE"}</span>
      <span className="demo-banner-source">{description}</span>
      <Link href="/" className="demo-banner-link">Exit demo</Link>
    </div>);
}
