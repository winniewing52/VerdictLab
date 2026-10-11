"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { startAnalysis } from "@/lib/api";
function LinkIcon() {
    return (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M9 12h6" strokeLinecap="round"/>
      <path d="M10.5 7H8a5 5 0 0 0 0 10h2.5" strokeLinecap="round"/>
      <path d="M13.5 17H16a5 5 0 0 0 0-10h-2.5" strokeLinecap="round"/>
    </svg>);
}
function FileIcon() {
    return (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M7 3h7l4 4v14H7z" strokeLinejoin="round"/>
      <path d="M14 3v4h4" strokeLinejoin="round"/>
      <path d="M9.5 13.5h5M9.5 16.5h5" strokeLinecap="round"/>
    </svg>);
}
function UploadIcon() {
    return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 16V4M7 9l5-5 5 5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>);
}
export default function TwoWaysIn() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedSource, setSelectedSource] = useState<"link" | "file" | null>(null);
    const [projectName, setProjectName] = useState("");
    const [url, setUrl] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [submittingLink, setSubmittingLink] = useState(false);
    const [submittingFile, setSubmittingFile] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [consentPublicData, setConsentPublicData] = useState(false);
    useEffect(() => {
        if (!selectedSource)
            return;
        function closeOnEscape(event: KeyboardEvent) {
            if (event.key === "Escape")
                setSelectedSource(null);
        }
        document.addEventListener("keydown", closeOnEscape);
        return () => document.removeEventListener("keydown", closeOnEscape);
    }, [selectedSource]);
    async function runLinkAnalysis(e: React.FormEvent) {
        e.preventDefault();
        if (!url.trim()) {
            setError("Paste a Reddit or YouTube URL first.");
            return;
        }
        setError(null);
        setSubmittingLink(true);
        try {
            const analysis = await startAnalysis({
                source_type: url.includes("youtu") ? "youtube" : "reddit",
                source_url: url.trim(),
                title: projectName.trim() || undefined,
                consent_public_data: consentPublicData,
            });
            router.push(`/workspace?run=${analysis.id}`);
        }
        catch (error) {
            setError(error instanceof Error ? error.message : "Couldn't start that analysis. Check the link and try again.");
        }
        finally {
            setSubmittingLink(false);
        }
    }
    async function uploadDataset() {
        if (!file) {
            fileInputRef.current?.click();
            return;
        }
        setError(null);
        setSubmittingFile(true);
        try {
            const analysis = await startAnalysis({
                source_type: "csv",
                file,
                title: projectName.trim() || undefined,
            });
            router.push(`/workspace?run=${analysis.id}`);
        }
        catch (error) {
            setError(error instanceof Error ? error.message : "Couldn't read that file — try a CSV or Excel export.");
        }
        finally {
            setSubmittingFile(false);
        }
    }
    return (<section className="max-w-7xl mx-auto px-5 py-12 sm:px-10 md:py-24">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8 sm:mb-12 pr-8 sm:pr-0">
        <div>
          <p className="font-mono text-xs text-signal tracking-wide mb-3">TWO WAYS IN</p>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">Pick your starting point</h2>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">

        <button type="button" onClick={() => setSelectedSource("link")} className={`text-left border rounded-md p-5 sm:p-8 flex flex-col transition-colors ${selectedSource === "link"
            ? "border-signal bg-panel"
            : "border-line hover:border-muted"}`}>
          <div className="text-signal mb-8">
            <LinkIcon />
          </div>
          <p className="font-mono text-xs text-muted mb-3">OPTION A</p>
          <h3 className="text-2xl font-bold mb-3">Analyze a link</h3>
          <p className="text-muted leading-relaxed mb-6">
            Paste a Reddit discussion, YouTube video, or channel. We detect the
            source and preview available public content.
          </p>

        </button>

        <button type="button" onClick={() => setSelectedSource("file")} className={`text-left border rounded-md p-5 sm:p-8 flex flex-col transition-colors ${selectedSource === "file"
            ? "border-signal bg-panel"
            : "border-line hover:border-muted"}`}>
          <div className="text-signal mb-8">
            <FileIcon />
          </div>
          <p className="font-mono text-xs text-muted mb-3">OPTION B</p>
          <h3 className="text-2xl font-bold mb-3">Upload a dataset</h3>
          <p className="text-muted leading-relaxed mb-6">
            Bring a CSV or Excel file. We guide column mapping and flag missing
            values and duplicates before analysis.
          </p>

        </button>
      </div>

      {selectedSource && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-labelledby="source-dialog-title" onClick={() => setSelectedSource(null)}>
          <div className="relative w-full max-w-2xl max-h-[90vh] max-h-[90dvh] overflow-y-auto border border-line rounded-md bg-panel p-6 md:p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setSelectedSource(null)} aria-label="Close source form" className="absolute right-5 top-5 text-muted text-2xl leading-none hover:text-white transition-colors">
              ×
            </button>

            <p className="font-mono text-xs text-signal mb-2">
              {selectedSource === "link" ? "OPTION A" : "OPTION B"}
            </p>
            <h2 id="source-dialog-title" className="text-2xl font-bold mb-6">
              {selectedSource === "link" ? "Analyze a link" : "Upload a dataset"}
            </h2>

            <label htmlFor="project-name" className="block text-sm font-medium mb-2">
              Project name
            </label>
            <input id="project-name" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Israel-Gaza Public Opinion" className="w-full bg-transparent border border-line rounded-sm px-4 py-3 outline-none focus:border-signal text-sm placeholder:text-muted"/>

            {selectedSource === "link" ? (<form onSubmit={runLinkAnalysis} className="mt-6">
                <label htmlFor="discussion-link" className="block text-sm font-medium mb-2">
                  Discussion link
                </label>
                <input id="discussion-link" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.reddit.com/r/... or https://www.youtube.com/watch?v=..." className="w-full bg-transparent border border-line rounded-sm px-4 py-3 outline-none focus:border-signal text-sm placeholder:text-muted"/>
                <label className="mt-5 flex gap-3 text-xs leading-relaxed text-muted">
                  <input type="checkbox" checked={consentPublicData} onChange={(e) => setConsentPublicData(e.target.checked)}/>
                  I have a lawful basis to analyse this public content and understand that it will be retained for 90 days unless deleted sooner. Usernames and URLs are redacted.
                </label>
                <button type="submit" disabled={submittingLink || !consentPublicData} className="mt-6 bg-signal text-ink font-medium px-5 py-3 rounded-sm hover:brightness-95 transition disabled:opacity-60">
                  {submittingLink ? "Starting…" : "Start analysis →"}
                </button>
              </form>) : (<div className="mt-6">
                <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="sr-only"/>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full border border-dashed border-line rounded-md px-6 py-12 flex flex-col items-center justify-center text-center hover:border-muted transition-colors">
                  <FileIcon />
                  <span className="block mt-3 text-sm font-medium">
                    {file ? file.name : "Drop a CSV or Excel file here, or click to browse"}
                  </span>
                  <span className="block mt-2 text-sm text-muted">
                    CSV, XLS, or XLSX with a text column (comment, body, message, etc.)
                  </span>
                </button>
                <button type="button" onClick={uploadDataset} disabled={submittingFile} className="mt-6 bg-signal text-ink font-medium px-5 py-3 rounded-sm hover:brightness-95 transition disabled:opacity-60">
                  {submittingFile ? "Uploading…" : "Start analysis →"}
                </button>
              </div>)}
          </div>
        </div>)}

      {error && <p className="mt-6 text-sm text-alert font-mono">{error}</p>}
    </section>);
}
