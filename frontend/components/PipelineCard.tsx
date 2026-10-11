"use client";
import { useEffect, useState } from "react";
import { getAnalysis, type Analysis } from "@/lib/api";
export default function PipelineCard({ analysisId }: {
    analysisId?: string;
}) {
    const [analysis, setAnalysis] = useState<Analysis | null>(null);
    const [isLive, setIsLive] = useState(false);
    useEffect(() => {
        if (!analysisId)
            return;
        let stop = false;
        async function poll() {
            try {
                const data = await getAnalysis(analysisId!);
                if (stop)
                    return;
                setAnalysis(data);
                setIsLive(data.status === "running" || data.status === "queued");
                if (data.status === "running" || data.status === "queued") {
                    setTimeout(poll, 1200);
                }
            }
            catch {
                if (!stop)
                    setTimeout(poll, 2500);
            }
        }
        poll();
        return () => {
            stop = true;
        };
    }, [analysisId]);
    if (!analysis)
        return null;
    const stageOrder = ["collecting_content", "cleaning_dedup", "model_comparison"];
    return (<div className="relative bg-panel border border-line rounded-md p-6 w-full max-w-md">
      {isLive && (<span className="absolute -top-3 right-6 bg-alert text-white text-[11px] font-mono font-semibold px-2 py-0.5 rounded-sm">
          LIVE
        </span>)}

      <div className="flex items-center justify-between mb-6">
        <p className="font-mono text-xs text-muted uppercase tracking-wide">
          Pipeline · {analysis.title}
        </p>
        <p className="font-mono text-xs text-muted">Run #{analysis.id}</p>
      </div>

      <div className="space-y-5">
        {stageOrder.map((key) => {
            const stage = analysis.stages[key];
            if (!stage)
                return null;
            const isQueued = stage.status === "queued";
            return (<div key={key}>
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className={isQueued ? "text-muted" : "text-white"}>{stage.label}</span>
                <span className={isQueued ? "text-muted font-mono text-xs" : "text-signal font-mono text-xs"}>
                  {isQueued ? "queued" : `${stage.progress}%`}
                </span>
              </div>
              <div className="h-1.5 bg-line rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${isQueued ? "bg-muted/40" : "bg-signal"}`} style={{ width: `${isQueued ? 6 : stage.progress}%` }}/>
              </div>
            </div>);
        })}
      </div>

      <div className="mt-8 pt-6 border-t border-line grid grid-cols-2 gap-4">
        <div>
          <p className="text-3xl font-bold">{analysis.records_in.toLocaleString()}</p>
          <p className="font-mono text-xs text-muted mt-1">Records in</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-alert">Not reported</p>
          <p className="font-mono text-xs text-muted mt-1">Model quality</p>
        </div>
      </div>
    </div>);
}
