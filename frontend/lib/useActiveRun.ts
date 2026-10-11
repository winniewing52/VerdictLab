"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AccountError, findSavedRun, getCurrentSessionToken, getDemoSample } from "@/lib/api";
import { isDemoPath } from "@/lib/demo";
export function useActiveRun() {
    const router = useRouter();
    const pathname = usePathname();
    const urlRun = useSearchParams().get("run");
    const [resolved, setResolved] = useState<string | null>(null);
    const [resolving, setResolving] = useState(!urlRun);
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        if (isDemoPath(pathname)) {
            let cancelled = false;
            setResolving(true);
            setError(null);
            getDemoSample()
                .then((sample) => { if (!cancelled)
                setResolved(sample.id); })
                .catch((reason) => {
                if (!cancelled)
                    setError(reason instanceof Error ? reason.message : "Couldn't load the sample analysis.");
            })
                .finally(() => { if (!cancelled)
                setResolving(false); });
            return () => { cancelled = true; };
        }
        if (!getCurrentSessionToken()) {
            router.replace("/workspace/access");
            return;
        }
        if (urlRun) {
            setResolving(false);
            return;
        }
        let cancelled = false;
        setResolving(true);
        setError(null);
        findSavedRun()
            .then((id) => { if (!cancelled)
            setResolved(id); })
            .catch((reason) => {
            if (reason instanceof AccountError && reason.status === 401) {
                router.replace("/workspace/access");
                return;
            }
            if (!cancelled)
                setError("Couldn't reach the analysis service. Make sure the backend is running, then retry.");
        })
            .finally(() => { if (!cancelled)
            setResolving(false); });
        return () => { cancelled = true; };
    }, [urlRun, pathname, attempt, router]);
    const retry = useCallback(() => setAttempt((n) => n + 1), []);
    return { runId: urlRun ?? resolved, resolving, error, retry };
}
