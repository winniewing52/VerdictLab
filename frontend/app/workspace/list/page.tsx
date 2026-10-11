"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TwoWaysIn from "@/components/TwoWaysIn";
import { AccountError, clearLastRunId, deleteAnalysis, getCurrentSessionToken, listAnalyses, setLastRunId, signOut, type Analysis, } from "@/lib/api";
function formatDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? ""
        : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
function statusStyle(status: Analysis["status"]) {
    if (status === "complete")
        return "text-signal";
    if (status === "failed")
        return "text-alert";
    return "text-muted";
}
export default function WorkspaceListPage() {
    const router = useRouter();
    const [items, setItems] = useState<Analysis[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showStartModal, setShowStartModal] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
    const [signingOut, setSigningOut] = useState(false);
    const load = useCallback(async () => {
        setError(null);
        try {
            const rows = await listAnalyses();
            rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
            setItems(rows);
            setSelectedIds((current) => new Set([...current].filter((id) => rows.some((row) => row.id === id))));
        }
        catch (loadError) {
            if (loadError instanceof AccountError && loadError.status === 401) {
                router.replace("/workspace/access");
                return;
            }
            setItems([]);
            setError("Couldn't reach the analysis service. Make sure the backend is running, then retry.");
        }
    }, [router]);
    useEffect(() => {
        if (!getCurrentSessionToken()) {
            router.replace("/workspace/access");
            return;
        }
        load();
    }, [load, router]);
    function openWorkspace(id: string) {
        setLastRunId(id);
        router.push(`/workspace?run=${encodeURIComponent(id)}`);
    }
    function toggleSelection(id: string) {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (next.has(id))
                next.delete(id);
            else
                next.add(id);
            return next;
        });
    }
    function toggleAll() {
        if (!items)
            return;
        setSelectedIds((current) => current.size === items.length ? new Set() : new Set(items.map((item) => item.id)));
    }
    async function handleDelete(item: Analysis) {
        if (!window.confirm(`Delete "${item.title}"? This can't be undone.`))
            return;
        setDeletingIds(new Set([item.id]));
        try {
            await deleteAnalysis(item.id);
            setItems((current) => (current ? current.filter((row) => row.id !== item.id) : current));
            setSelectedIds((current) => {
                const next = new Set(current);
                next.delete(item.id);
                return next;
            });
        }
        catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : "Could not delete this workspace.");
        }
        finally {
            setDeletingIds(new Set());
        }
    }
    async function handleBulkDelete() {
        if (!items || selectedIds.size === 0 || deletingIds.size > 0)
            return;
        const selectedItems = items.filter((item) => selectedIds.has(item.id));
        const noun = selectedItems.length === 1 ? "workspace" : "workspaces";
        if (!window.confirm(`Delete ${selectedItems.length} ${noun}? This can't be undone.`))
            return;
        setError(null);
        setDeletingIds(new Set(selectedItems.map((item) => item.id)));
        const results = await Promise.allSettled(selectedItems.map((item) => deleteAnalysis(item.id)));
        const failedIds = new Set(selectedItems
            .filter((_, index) => results[index].status === "rejected")
            .map((item) => item.id));
        const deletedIds = new Set(selectedItems.map((item) => item.id));
        failedIds.forEach((id) => deletedIds.delete(id));
        setItems((current) => (current ? current.filter((row) => !deletedIds.has(row.id)) : current));
        setSelectedIds(failedIds);
        setDeletingIds(new Set());
        if (failedIds.size > 0) {
            setError(`${deletedIds.size} ${deletedIds.size === 1 ? "workspace was" : "workspaces were"} deleted, but ${failedIds.size} could not be deleted. Please retry.`);
        }
    }
    async function handleLogout() {
        setSigningOut(true);
        try {
            await signOut(false);
        }
        finally {
            clearLastRunId();
            router.push("/workspace/access");
        }
    }
    return (<div className="min-h-screen bg-ink text-foreground">
      <header className="flex items-center justify-between border-b border-line px-6 py-5 md:px-10">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-signal font-bold text-ink">V</div>
          <span className="text-lg font-semibold tracking-tight">
            VERDICT<span className="text-signal">LAB</span>
          </span>
        </div>
        <div className="flex items-center gap-6 font-mono text-xs uppercase tracking-wider text-muted">
          <a href="/workspace/settings" className="transition hover:text-white">Settings</a>
          <button type="button" onClick={handleLogout} disabled={signingOut} className="transition hover:text-white disabled:opacity-60">
            {signingOut ? "Signing out…" : "Log out"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12 md:px-10">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-3 font-mono text-xs uppercase tracking-wide text-signal">Your workspaces</p>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Pick up where you left off</h1>
            <p className="mt-3 max-w-xl text-muted">
              Open a saved analysis, or start a new workspace from a Reddit / YouTube link or your own dataset.
            </p>
          </div>
          <button type="button" onClick={() => setShowStartModal(true)} className="rounded-sm bg-signal px-5 py-3 text-sm font-medium text-ink transition hover:brightness-95">
            + NEW WORKSPACE
          </button>
        </div>

        {error && (<div className="mb-8 max-w-2xl rounded-md border border-line p-5">
            <p className="font-mono text-xs text-alert">{error}</p>
            <button type="button" onClick={load} className="mt-4 rounded-sm bg-signal px-4 py-2 text-sm font-medium text-ink">
              RETRY
            </button>
          </div>)}

        {items === null && <p className="font-mono text-xs text-muted">Loading your workspaces…</p>}

        {items !== null && items.length === 0 && !error && (<div className="max-w-2xl rounded-md border border-line p-8">
            <h2 className="text-2xl font-bold">No workspaces yet</h2>
            <p className="mt-3 text-muted">Create your first one to generate results from real source data.</p>
            <button type="button" onClick={() => setShowStartModal(true)} className="mt-6 rounded-sm bg-signal px-5 py-3 text-sm font-medium text-ink">
              START AN ANALYSIS
            </button>
          </div>)}

        {items !== null && items.length > 0 && (<>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-y border-line py-3">
              <label className="flex items-center gap-3 font-mono text-xs uppercase tracking-wider text-muted">
                <input type="checkbox" checked={selectedIds.size === items.length} onChange={toggleAll} aria-label="Select all workspaces" className="h-4 w-4 accent-signal"/>
                {selectedIds.size === items.length ? "Deselect all" : "Select all"}
              </label>
              {selectedIds.size > 0 && (<button type="button" onClick={handleBulkDelete} disabled={deletingIds.size > 0} className="rounded-sm border border-alert px-4 py-2 font-mono text-xs uppercase tracking-wider text-alert transition hover:bg-alert hover:text-white disabled:opacity-60">
                  {deletingIds.size > 0 ? "Deleting…" : `Delete selected (${selectedIds.size})`}
                </button>)}
            </div>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (<div key={item.id} className={`flex flex-col justify-between rounded-md border bg-panel p-6 ${selectedIds.has(item.id) ? "border-signal" : "border-line"}`}>
                  <div>
                    <div className="mb-4 flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-widest">
                      <label className="flex items-center gap-2 text-muted">
                        <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelection(item.id)} aria-label={`Select ${item.title || "Untitled analysis"}`} className="h-4 w-4 accent-signal"/>
                        <span className="sr-only">Select workspace</span>
                      </label>
                      <span className="text-muted">{item.source_type}</span>
                      <span className={statusStyle(item.status)}>{item.status}</span>
                    </div>
                    <h3 className="break-words text-xl font-semibold leading-snug">{item.title || "Untitled analysis"}</h3>
                    <p className="mt-3 font-mono text-xs text-muted">
                      {item.records_in ? `${item.records_in.toLocaleString()} records · ` : ""}
                      {formatDate(item.created_at)}
                    </p>
                  </div>
                  <div className="mt-6 flex items-center justify-between">
                    <button type="button" onClick={() => openWorkspace(item.id)} className="rounded-sm bg-signal px-4 py-2 text-sm font-medium text-ink transition hover:brightness-95">
                      OPEN →
                    </button>
                    <button type="button" onClick={() => handleDelete(item)} disabled={deletingIds.has(item.id)} className="font-mono text-xs uppercase tracking-wider text-muted transition hover:text-alert disabled:opacity-60">
                      {deletingIds.has(item.id) ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>))}
            </div>
          </>)}
      </main>

      {showStartModal && (<div className="fixed inset-0 z-50 overflow-y-auto bg-ink/95 px-4 py-8 md:px-8" role="dialog" aria-modal="true" onClick={() => setShowStartModal(false)}>
          <div className="relative mx-auto max-w-7xl border border-line bg-ink" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setShowStartModal(false)} aria-label="Close start analysis dialog" className="absolute right-6 top-5 z-10 text-2xl leading-none text-muted hover:text-white">
              ×
            </button>
            <TwoWaysIn />
          </div>
        </div>)}
    </div>);
}
