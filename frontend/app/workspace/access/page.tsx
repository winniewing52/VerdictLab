"use client";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AccountError, confirmAccountVerification, requestAccountVerification, resendVerificationCode, signIn, startAnalysis, } from "@/lib/api";
type Mode = "sign-in" | "create";
type CreateStep = "credentials" | "verify";
function WorkspaceAccessInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [mode, setMode] = useState<Mode>("sign-in");
    const [step, setStep] = useState<CreateStep>("credentials");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [devCode, setDevCode] = useState<string | null>(null);
    function switchMode(next: Mode) {
        setMode(next);
        setStep("credentials");
        setError(null);
        setNotice(null);
        setDevCode(null);
        setCode("");
    }
    async function finishSignIn() {
        const sourceUrl = searchParams.get("url");
        if (!sourceUrl) {
            router.push("/workspace/list");
            return;
        }
        try {
            const analysis = await startAnalysis({
                source_type: searchParams.get("source") === "youtube" ? "youtube" : "reddit",
                source_url: sourceUrl,
                title: searchParams.get("title") || undefined,
            });
            router.push(`/workspace?run=${analysis.id}`);
        }
        catch {
            setError("Couldn't start that analysis. Check the link and try again.");
        }
    }
    async function handleCredentialsSubmit(event: FormEvent) {
        event.preventDefault();
        if (!email.trim() || !password.trim()) {
            setError("Enter your email and password to continue.");
            return;
        }
        setError(null);
        setNotice(null);
        setSubmitting(true);
        try {
            if (mode === "sign-in") {
                await signIn(email, password);
                await finishSignIn();
            }
            else {
                const result = await requestAccountVerification(email, password);
                if (result.delivered) {
                    setNotice(`We sent a 6-digit verification code to ${result.email}.`);
                    setDevCode(null);
                }
                else {
                    setNotice(`Verification code for ${result.email} (dev mode - no email backend configured):`);
                    setDevCode(result.devCode ?? null);
                }
                setStep("verify");
            }
        }
        catch (accountError) {
            setError(accountError instanceof AccountError ? accountError.message : "Something went wrong. Please try again.");
        }
        finally {
            setSubmitting(false);
        }
    }
    async function handleVerifySubmit(event: FormEvent) {
        event.preventDefault();
        if (!code.trim()) {
            setError("Enter the verification code sent to your email.");
            return;
        }
        setError(null);
        setSubmitting(true);
        try {
            await confirmAccountVerification(email, code);
            await finishSignIn();
        }
        catch (accountError) {
            setError(accountError instanceof AccountError ? accountError.message : "Something went wrong. Please try again.");
        }
        finally {
            setSubmitting(false);
        }
    }
    async function handleResend() {
        setError(null);
        setSubmitting(true);
        try {
            const result = await resendVerificationCode(email);
            if (result.delivered) {
                setNotice(`We sent a new code to ${email}.`);
                setDevCode(null);
            }
            else {
                setNotice(`New verification code for ${email} (dev mode - no email backend configured):`);
                setDevCode(result.devCode ?? null);
            }
            setCode("");
        }
        catch (accountError) {
            setError(accountError instanceof AccountError ? accountError.message : "Something went wrong. Please try again.");
        }
        finally {
            setSubmitting(false);
        }
    }
    return (<main className="min-h-screen bg-ink px-6 py-10 text-foreground md:px-12 lg:px-20">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col">
        <button type="button" onClick={() => router.push("/")} className="self-end font-mono text-xs uppercase tracking-wider text-muted transition hover:text-white">
          <span className="mr-2 text-base">←</span> Back to overview
        </button>

        <div className="grid flex-1 items-center gap-10 py-8 sm:gap-16 xl:grid-cols-[1fr_510px] xl:gap-20">
          <section className="max-w-2xl">
            <p className="mb-6 font-mono text-xs font-medium uppercase tracking-wide text-signal">Workspace access</p>
            <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl xl:text-6xl">
              Your research workspace,
              <span className="mt-3 block bg-signal px-3 py-1 text-ink italic">source-traced and private.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:mt-8 sm:text-lg">
              Sign in to keep every analysis run, dataset, and exported report tied to your own account - with a full evidence trail behind each score.
            </p>
            <p className="mt-10 font-mono text-xs uppercase tracking-wide text-muted"><span className="mr-3 text-lg text-signal">♢</span>Fair use · source-traced · deletable</p>
          </section>

          <section className="w-full max-w-xl border border-line bg-panel p-5 sm:p-8 md:p-9 xl:max-w-none">
            {step === "credentials" ? (<>
                <div className="mb-9 grid grid-cols-2 border border-line font-mono text-xs uppercase tracking-wide">
                  <button type="button" onClick={() => switchMode("sign-in")} className={`py-3 transition ${mode === "sign-in" ? "bg-signal text-ink" : "text-muted hover:text-white"}`}>Sign in</button>
                  <button type="button" onClick={() => switchMode("create")} className={`border-l border-line py-3 transition ${mode === "create" ? "bg-signal text-ink" : "text-muted hover:text-white"}`}>Create account</button>
                </div>

                <form onSubmit={handleCredentialsSubmit}>
                  <label htmlFor="access-email" className="mb-2 block text-sm font-semibold">Email</label>
                  <input id="access-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@lab.org" className="mb-6 w-full border border-line bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-signal"/>
                  <label htmlFor="access-password" className="mb-2 block text-sm font-semibold">Password</label>
                  <input id="access-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" className="w-full border border-line bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-signal"/>
                  <button type="submit" disabled={submitting} className="mt-5 w-full bg-signal py-3.5 font-semibold text-ink transition hover:brightness-95 disabled:opacity-60">
                    {submitting ? (mode === "sign-in" ? "Signing in..." : "Sending code...") : mode === "sign-in" ? "Sign in" : "Create account"}
                  </button>
                  {error && <p className="mt-3 font-mono text-xs text-alert">{error}</p>}
                </form>

                <div className="my-8 flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-muted"><span className="h-px flex-1 bg-line"/> or <span className="h-px flex-1 bg-line"/></div>
                <button type="button" onClick={() => { window.location.href = "https://accounts.google.com/"; }} className="w-full border border-line py-3.5 text-sm font-semibold text-foreground transition hover:border-muted">Continue with Google</button>
                <p className="mt-7 font-mono text-[10px] uppercase leading-relaxed tracking-wide text-muted">By continuing you agree to analyse public data responsibly under fair-use terms.</p>
              </>) : (<>
                <button type="button" onClick={() => { setStep("credentials"); setError(null); setNotice(null); setDevCode(null); setCode(""); }} className="mb-6 font-mono text-xs uppercase tracking-wider text-muted transition hover:text-white">
                  <span className="mr-2 text-base">←</span> Back
                </button>
                <p className="mb-2 font-mono text-xs font-medium uppercase tracking-wide text-signal">Verify your email</p>
                <h2 className="mb-6 text-2xl font-bold leading-tight">Enter the code we sent to<br />{email}</h2>

                {notice && (<div className="mb-6 border border-line bg-ink p-4 font-mono text-xs leading-relaxed text-muted">
                    <p>{notice}</p>
                    {devCode && <p className="mt-2 text-2xl tracking-[0.3em] text-signal">{devCode}</p>}
                  </div>)}

                <form onSubmit={handleVerifySubmit}>
                  <label htmlFor="verification-code" className="mb-2 block text-sm font-semibold">Verification code</label>
                  <input id="verification-code" type="text" inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" className="w-full border border-line bg-transparent px-4 py-3 text-center text-lg tracking-[0.5em] outline-none placeholder:text-muted focus:border-signal"/>
                  <button type="submit" disabled={submitting} className="mt-5 w-full bg-signal py-3.5 font-semibold text-ink transition hover:brightness-95 disabled:opacity-60">
                    {submitting ? "Verifying..." : "Verify & create account"}
                  </button>
                  {error && <p className="mt-3 font-mono text-xs text-alert">{error}</p>}
                </form>

                <button type="button" onClick={handleResend} disabled={submitting} className="mt-6 font-mono text-xs uppercase tracking-wide text-muted underline-offset-4 transition hover:text-white hover:underline disabled:opacity-60">
                  Didn't get it? Resend code
                </button>
              </>)}
          </section>
        </div>
      </div>
    </main>);
}
export default function WorkspaceAccessPage() {
    return (<Suspense fallback={null}>
      <WorkspaceAccessInner />
    </Suspense>);
}
