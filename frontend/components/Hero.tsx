"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getDemoSample, type Analysis } from "@/lib/api";
export default function Hero() {
    const [url, setUrl] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [sample, setSample] = useState<Analysis | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();
    useEffect(() => {
        getDemoSample().then(setSample).catch(() => {
        });
    }, []);
    function handleStart(e: React.FormEvent) {
        e.preventDefault();
        if (!url.trim()) {
            setError("Paste a public Reddit or YouTube link first.");
            inputRef.current?.focus();
            return;
        }
        setError(null);
        const params = new URLSearchParams({
            source: url.includes("youtu") ? "youtube" : "reddit",
            url: url.trim(),
        });
        router.push(`/workspace/access?${params.toString()}`);
    }
    return (<section className="relative overflow-hidden border-b border-line" style={{
            backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.07) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
        }}>
      <div className="relative mx-auto grid min-h-[640px] max-w-[1440px] items-end gap-12 px-5 pb-10 pt-12 sm:px-10 lg:grid-cols-[1fr_427px] lg:gap-16 lg:px-[clamp(2.5rem,9vw,7.5rem)] lg:pb-12 lg:pt-[52px]">
        <div className="self-start lg:self-stretch lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="font-['Space_Mono',ui-monospace,monospace] text-xs text-signal sm:text-[13px]">
               ANALYSIS — PUBLIC
            </p>

            <h1 className="mt-5 max-w-[620px] font-display text-[clamp(3.25rem,13vw,4.75rem)] font-normal uppercase leading-[0.95] text-[#F4F0E3] lg:text-[clamp(4rem,6.2vw,5.25rem)]">
              From noise
              <br />
              to verdict.
            </h1>
          </div>

          <p className="mt-8 max-w-[540px] text-base font-medium leading-[1.65] text-[#c9c5b8] sm:text-lg lg:mt-10">
            Turn any public conversation into a clear, explainable verdict you
            can trace back to the evidence.
          </p>

          <div className="mt-8 max-w-[620px] border border-[#2a2a2c] bg-[#0f0f10] p-4 sm:p-5" aria-label="How VerdictLab turns a conversation into a verdict">
            <div className="flex items-center justify-between gap-3 font-['Space_Mono',ui-monospace,monospace] text-[10px] uppercase tracking-[0.12em] text-[#8b8b90]">
              <span>Public conversation</span>
              <span className="text-signal">
                {sample ? `${sample.records_in.toLocaleString()} records` : "sample records"}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1.15fr] sm:items-center">
              <div className="border border-[#2a2a2c] bg-[#0a0a0b] p-3">
                <p className="font-['Space_Mono',ui-monospace,monospace] text-[10px] uppercase text-[#8b8b90]">
                  Source
                </p>
                <p className="mt-2 truncate text-sm font-semibold text-[#EDEDEF]">
                  {sample?.source_url?.match(/reddit\.com\/r\/([^/]+)/i)?.[1]
            ? `r/${sample.source_url.match(/reddit\.com\/r\/([^/]+)/i)?.[1]}`
            : "Reddit sample"}
                </p>
                <p className="mt-1 text-xs text-[#8b8b90]">posts + comments</p>
              </div>
              <div className="hidden text-center text-xl text-signal sm:block" aria-hidden="true">
                →
              </div>
              <div className="border border-signal/50 bg-signal/10 p-3">
                <p className="font-['Space_Mono',ui-monospace,monospace] text-[10px] uppercase text-signal">
                  Verdict
                </p>
                <p className="mt-2 text-sm font-semibold text-[#F4F0E3]">
                  Explainable signal, with uncertainty shown.
                </p>
                <p className="mt-1 text-xs text-[#bdb9ad]">
                  Open the sample to inspect the evidence behind every claim.
                </p>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleStart} className="w-full border border-[#2a2a2c] bg-[#0f0f10] p-6">
          <label htmlFor="hero-url" className="block font-['Space_Mono',ui-monospace,monospace] text-xs uppercase text-[#bdb9ad]">
            Paste a public Reddit or YouTube URL
          </label>

          <div className="mt-5 flex">
            <input id="hero-url" ref={inputRef} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="reddit.com/r/topic or youtube.com/watch…" autoComplete="off" spellCheck={false} className="h-11 min-w-0 flex-1 border border-[#2a2a2c] bg-[#0a0a0b] px-4 font-['Space_Mono',ui-monospace,monospace] text-[13px] text-[#EDEDEF] outline-none placeholder:text-[#8b8b90] focus-visible:border-signal"/>
            <button type="submit" className="h-11 shrink-0 bg-signal px-5 text-base font-bold text-ink transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal sm:px-6">
              Analyze
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/workspace/access?source=csv" className="inline-flex h-10 items-center border border-[#2a2a2c] px-4 font-['Space_Mono',ui-monospace,monospace] text-[13px] text-[#d6d2c6] transition hover:border-[#55555a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal">
              Upload CSV / XLSX
            </Link>
            <Link href="/demo" className="inline-flex h-10 items-center border border-signal/40 bg-signal/10 px-4 font-['Space_Mono',ui-monospace,monospace] text-[13px] text-signal transition hover:bg-signal/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal">
              View sample analysis
            </Link>
          </div>

          <div className="mt-4 font-['Space_Mono',ui-monospace,monospace] text-xs">
            {error ? (<p role="alert" className="text-alert">
                {error}
              </p>) : (<p className="text-[#8b8b90]">Live sample ready</p>)}
          </div>
        </form>
      </div>
    </section>);
}
