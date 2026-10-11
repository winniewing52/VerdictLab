"use client";
import Link from "next/link";
export default function NoAnalysisSelected() {
    return (<div className="flex min-h-[420px] items-center justify-center px-6 py-16">
      <div className="max-w-xl text-center">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">Workspace</p>
        <h1 className="mt-4 text-3xl font-bold text-white">No analysis selected</h1>
        <p className="mt-4 text-sm leading-7 text-muted">
          Please select an analysis from your workspace. If you have not run an
          analysis yet, start one first and return here when it is ready.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/workspace/list" className="rounded-sm bg-signal px-5 py-3 text-sm font-semibold text-ink">
            SELECT AN ANALYSIS
          </Link>
          <Link href="/workspace/access" className="rounded-sm border border-line px-5 py-3 text-sm font-semibold text-white">
            START AN ANALYSIS
          </Link>
        </div>
      </div>
    </div>);
}
