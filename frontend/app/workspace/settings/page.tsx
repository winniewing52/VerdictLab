"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardSidebar from "@/components/DashboardSidebar";
import LogoutModal from "@/components/LogoutModal";
import { AccountError, Profile, SessionInfo, changePassword, deleteAccount, getCurrentSessionToken, getProfile, listSessions, revokeSession, signOut, signOutOtherSessions, updateProfile, updateTwoFactor, } from "@/lib/api";
const ROLE_OPTIONS = [
    "Undergraduate Researcher",
    "Final Year Researcher",
    "Postgraduate Researcher",
    "PhD Candidate",
    "Academic Staff",
    "Industry Researcher",
];
const RESEARCH_FOCUS_MAX = 180;
const PAGE_SECTIONS = [
    { id: "profile", label: "Profile" },
    { id: "security", label: "Security" },
    { id: "analysis-defaults", label: "Analysis defaults" },
    { id: "notifications", label: "Notifications" },
    { id: "appearance", label: "Appearance" },
    { id: "data-privacy", label: "Data & privacy" },
    { id: "danger-zone", label: "Danger zone" },
];
function memberSince(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
function timeAgo(iso: string): string {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1)
        return "just now";
    if (mins < 60)
        return `${mins} minute${mins === 1 ? "" : "s"} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24)
        return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30)
        return `${days} day${days === 1 ? "" : "s"} ago`;
    const months = Math.floor(days / 30);
    if (months < 12)
        return `${months} month${months === 1 ? "" : "s"} ago`;
    const years = Math.floor(months / 12);
    return `${years} year${years === 1 ? "" : "s"} ago`;
}
function initials(name: string | null, email: string): string {
    if (name && name.trim()) {
        const parts = name.trim().split(/\s+/);
        return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
    }
    return email.slice(0, 2).toUpperCase();
}
function profileStrength(profile: Profile): number {
    const checks = [
        !!profile.name,
        !!profile.email,
        !!profile.institution,
        !!profile.role,
        !!profile.researchFocus,
        profile.twoFactorEnabled,
    ];
    const filled = checks.filter(Boolean).length;
    return Math.round((filled / checks.length) * 100);
}
function SettingsPage() {
    const router = useRouter();
    const selectedRun = useSearchParams().get("run");
    const [token, setToken] = useState<string | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [sessions, setSessions] = useState<SessionInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [logoutOpen, setLogoutOpen] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const [passwordOpen, setPasswordOpen] = useState(false);
    const [sessionsOpen, setSessionsOpen] = useState(false);
    const [signOutAllOpen, setSignOutAllOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [displayName, setDisplayName] = useState("");
    const [institution, setInstitution] = useState("");
    const [role, setRole] = useState(ROLE_OPTIONS[1]);
    const [researchFocus, setResearchFocus] = useState("");
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileErr, setProfileErr] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState("profile");
    const [twoFactorBusy, setTwoFactorBusy] = useState(false);
    const [analysisDefault, setAnalysisDefault] = useState("balanced");
    const [runAlerts, setRunAlerts] = useState(true);
    const [compactDensity, setCompactDensity] = useState(false);
    const [retentionDays, setRetentionDays] = useState("90");
    useEffect(() => {
        const t = getCurrentSessionToken();
        if (!t) {
            router.push("/workspace/access");
            return;
        }
        setToken(t);
        (async () => {
            try {
                const [p, s] = await Promise.all([getProfile(t), listSessions(t)]);
                setProfile(p);
                setSessions(s);
                hydrateForm(p);
            }
            catch (e) {
                setError(e instanceof AccountError ? e.message : "Couldn't load your settings.");
            }
            finally {
                setLoading(false);
            }
        })();
    }, [router]);
    function hydrateForm(p: Profile) {
        setDisplayName(p.name ?? "");
        setInstitution(p.institution ?? "");
        setRole(p.role ?? ROLE_OPTIONS[1]);
        setResearchFocus(p.researchFocus ?? "");
    }
    useEffect(() => {
        setAnalysisDefault(window.localStorage.getItem("verdictlab.analysis.default") ?? "balanced");
        setRunAlerts(window.localStorage.getItem("verdictlab.notifications.alerts") !== "false");
        setCompactDensity(window.localStorage.getItem("verdictlab.appearance.compact") === "true");
        setRetentionDays(window.localStorage.getItem("verdictlab.privacy.retention") ?? "90");
    }, []);
    function savePreference(key: string, value: string) {
        window.localStorage.setItem(key, value);
        flash("Preference saved.");
    }
    async function toggleTwoFactor() {
        if (!token || !profile)
            return;
        const password = window.prompt(`Enter your password to turn two-factor ${profile.twoFactorEnabled ? "off" : "on"}.`);
        if (password === null)
            return;
        setTwoFactorBusy(true);
        try {
            const updated = await updateTwoFactor(!profile.twoFactorEnabled, password, token);
            setProfile(updated);
            flash(updated.twoFactorEnabled ? "Two-factor authentication enabled." : "Two-factor authentication disabled.");
        }
        catch (e) {
            flash(e instanceof AccountError ? e.message : "Couldn't update two-factor authentication.");
        }
        finally {
            setTwoFactorBusy(false);
        }
    }
    const dirty = useMemo(() => {
        if (!profile)
            return false;
        return (displayName !== (profile.name ?? "") ||
            institution !== (profile.institution ?? "") ||
            role !== (profile.role ?? ROLE_OPTIONS[1]) ||
            researchFocus !== (profile.researchFocus ?? ""));
    }, [profile, displayName, institution, role, researchFocus]);
    function flash(msg: string) {
        setToast(msg);
        window.setTimeout(() => setToast(null), 3500);
    }
    async function confirmLogout(allDevices: boolean) {
        setSigningOut(true);
        try {
            await signOut(allDevices);
        }
        finally {
            setSigningOut(false);
            setLogoutOpen(false);
            router.push("/workspace/access");
        }
    }
    async function saveProfile() {
        if (!token)
            return;
        setSavingProfile(true);
        setProfileErr(null);
        try {
            const p = await updateProfile({ name: displayName, institution, role, researchFocus }, token);
            setProfile(p);
            hydrateForm(p);
            flash("Profile updated.");
        }
        catch (e) {
            setProfileErr(e instanceof AccountError ? e.message : "Couldn't save your profile.");
        }
        finally {
            setSavingProfile(false);
        }
    }
    function discardProfile() {
        if (profile)
            hydrateForm(profile);
        setProfileErr(null);
    }
    if (loading) {
        return (<div className="pulse-app min-h-screen bg-ink">
        <DashboardSidebar active="Settings" runId={selectedRun}/>
        <div className="dashboard-shell flex items-center justify-center">
          <p className="font-mono text-xs text-muted">Loading settings…</p>
        </div>
      </div>);
    }
    const strength = profile ? profileStrength(profile) : 0;
    return (<div className="pulse-app min-h-screen bg-ink bg-grid text-white">
      <DashboardSidebar active="Settings" runId={selectedRun}/>
      <div className="dashboard-shell">
      <main className="max-w-[1400px] mx-auto px-6 py-10 md:px-12 md:py-14">

        <div className="flex items-start justify-between gap-6 mb-10">
          <div>
            <p className="font-mono text-xs text-signal uppercase tracking-[0.17em]">
              Account · VerdictLab
            </p>
            <h1 className="mt-3 font-bold text-4xl sm:text-5xl md:text-6xl text-white" style={{ fontFamily: "Georgia, serif" }}>
              Settings
            </h1>
            <p className="mt-3 max-w-xl text-muted text-sm md:text-base leading-relaxed">
              Control your research identity, session security, model defaults and how long
              analysed public data is retained.
            </p>
          </div>
          <button type="button" onClick={() => setLogoutOpen(true)} className="shrink-0 border border-alert/40 text-alert font-mono text-sm px-5 py-2.5 rounded-lg hover:bg-alert/10 transition-colors">
            Log out
          </button>
        </div>

        {error && (<div className="mb-6 border border-alert/30 bg-alert/10 text-alert text-sm rounded-lg px-4 py-3">
            {error}
          </div>)}
        {toast && (<div className="mb-6 border border-signal/30 bg-signal/10 text-signal text-sm rounded-lg px-4 py-3">
            {toast}
          </div>)}

        {profile && (<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            <div className="bg-panel border border-line rounded-2xl p-5 flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-signal text-ink font-mono font-bold text-sm flex items-center justify-center shrink-0">
                {initials(profile.name, profile.email)}
              </div>
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm truncate">
                  {profile.name || "Unnamed researcher"}
                </p>
                <p className="text-muted text-xs font-mono truncate">{profile.email}</p>
              </div>
            </div>

            <div className="bg-panel border border-line rounded-2xl p-5">
              <p className="font-mono text-xs text-muted uppercase tracking-[0.15em]">
                Member since
              </p>
              <p className="mt-2 font-bold text-xl text-white">{memberSince(profile.createdAt)}</p>
            </div>

            <div className="bg-panel border border-line rounded-2xl p-5">
              <p className="font-mono text-xs text-muted uppercase tracking-[0.15em]">
                Two-factor
              </p>
              <p className={`mt-2 font-bold text-xl ${profile.twoFactorEnabled ? "text-signal" : "text-alert"}`}>
                {profile.twoFactorEnabled ? "On" : "Off"}
              </p>
            </div>

            <div className="bg-panel border border-line rounded-2xl p-5">
              <p className="font-mono text-xs text-muted uppercase tracking-[0.15em]">
                Profile strength
              </p>
              <p className="mt-2 font-bold text-xl text-white">{strength}%</p>
              <div className="mt-3 h-1.5 rounded-full bg-line overflow-hidden">
                <div className="h-full rounded-full bg-signal transition-all" style={{ width: `${strength}%` }}/>
              </div>
            </div>
          </div>)}

        <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-8 items-start">

          <nav className="lg:sticky lg:top-10">
            <p className="font-mono text-xs text-muted uppercase tracking-[0.15em] mb-3">
              On this page
            </p>
            <div className="flex flex-row gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
              {PAGE_SECTIONS.map((s) => (<a key={s.id} href={`#${s.id}`} onClick={() => setActiveSection(s.id)} className={`font-mono text-sm px-4 py-2.5 rounded-lg border transition-colors whitespace-nowrap shrink-0 ${activeSection === s.id
                ? "border-signal/40 bg-signal/10 text-signal"
                : "border-transparent text-muted hover:text-white"}`}>
                  {s.label}
                </a>))}
            </div>
          </nav>

          <div className="min-w-0 flex flex-col gap-8">

            {profile && (<section id="profile" className="bg-panel border border-line rounded-2xl p-5 sm:p-7 scroll-mt-10">
                <div className="flex items-start gap-3 mb-7">
                  <div className="w-9 h-9 rounded-full border border-line flex items-center justify-center shrink-0 text-signal">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="8" r="4"/>
                      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>
                    </svg>
                  </div>
                  <div>
                    <p className="font-mono text-xs text-muted uppercase tracking-[0.15em]">Identity</p>
                    <h2 className="font-bold text-white text-xl mt-0.5">Research profile</h2>
                    <p className="text-muted text-sm mt-1">
                      Shown on exported reports and shared analysis links.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block font-mono text-xs text-muted uppercase tracking-wide mb-2">
                      Display name
                    </label>
                    <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" className="w-full bg-ink border border-line rounded-lg px-3.5 py-3 text-white text-sm font-mono outline-none focus:border-signal"/>
                  </div>
                  <div>
                    <label className="block font-mono text-xs text-muted uppercase tracking-wide mb-2">
                      Email
                    </label>
                    <input value={profile.email} readOnly className="w-full bg-ink border border-line rounded-lg px-3.5 py-3 text-white/80 text-sm font-mono outline-none cursor-not-allowed"/>
                    <p className="text-muted text-xs mt-2">Used for sign-in and run alerts.</p>
                  </div>

                  <div>
                    <label className="block font-mono text-xs text-muted uppercase tracking-wide mb-2">
                      Institution
                    </label>
                    <input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Your institution" className="w-full bg-ink border border-line rounded-lg px-3.5 py-3 text-white text-sm font-mono outline-none focus:border-signal"/>
                  </div>
                  <div>
                    <label className="block font-mono text-xs text-muted uppercase tracking-wide mb-2">
                      Role
                    </label>
                    <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full bg-ink border border-line rounded-lg px-3.5 py-3 text-white text-sm font-mono outline-none focus:border-signal appearance-none">
                      {ROLE_OPTIONS.map((r) => (<option key={r} value={r}>
                          {r}
                        </option>))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block font-mono text-xs text-muted uppercase tracking-wide mb-2">
                      Research focus
                    </label>
                    <textarea value={researchFocus} onChange={(e) => setResearchFocus(e.target.value.slice(0, RESEARCH_FOCUS_MAX))} rows={3} placeholder="What are you researching?" className="w-full bg-ink border border-line rounded-lg px-3.5 py-3 text-white text-sm font-mono outline-none focus:border-signal resize-y"/>
                    <p className="text-muted text-xs font-mono mt-2">
                      {researchFocus.length}/{RESEARCH_FOCUS_MAX} characters
                    </p>
                  </div>
                </div>

                {profileErr && (<p className="text-alert text-xs font-mono mt-4">{profileErr}</p>)}

                <div className="flex justify-end gap-4 mt-7">
                  <button type="button" onClick={discardProfile} disabled={!dirty || savingProfile} className="font-mono text-sm text-muted px-4 py-2.5 hover:text-white disabled:opacity-40 disabled:hover:text-muted">
                    Discard
                  </button>
                  <button type="button" onClick={saveProfile} disabled={!dirty || savingProfile} className="bg-signal text-ink font-mono font-semibold text-sm px-6 py-2.5 rounded-lg disabled:opacity-50 hover:brightness-95 transition">
                    {savingProfile ? "Saving…" : "Save profile"}
                  </button>
                </div>
              </section>)}

            <section id="security" className="bg-panel border border-line rounded-2xl p-5 sm:p-7 scroll-mt-10">
              <div className="flex items-center gap-2 mb-5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F2CB2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="10" width="16" height="10" rx="2"/>
                  <path d="M8 10V7a4 4 0 0 1 8 0v3"/>
                </svg>
                <h2 className="font-bold text-white text-lg">Security</h2>
              </div>

              <SettingsRow title="Password" subtitle={`Last changed ${timeAgo(profile?.passwordChangedAt ?? new Date().toISOString())}`} action="Change" onAction={() => setPasswordOpen(true)}/>
              <div className="border-t border-line"/>
              <SettingsRow title="Active sessions" subtitle={`${sessions.length} device${sessions.length === 1 ? "" : "s"} signed in`} action="Manage" onAction={() => setSessionsOpen(true)}/>
              <div className="border-t border-line"/>
              <SettingsRow title="Sign out everywhere" subtitle="Ends all sessions but this one" action="Sign out all" onAction={() => setSignOutAllOpen(true)}/>
              <div className="border-t border-line"/>
              <SettingsRow title="Two-factor authentication" subtitle={profile?.twoFactorEnabled ? "Enabled for your account" : "Add a password check before changing this setting"} action={twoFactorBusy ? "Saving…" : profile?.twoFactorEnabled ? "Turn off" : "Turn on"} onAction={toggleTwoFactor}/>
            </section>

            <section id="analysis-defaults" className="bg-panel border border-line rounded-2xl p-5 sm:p-7 scroll-mt-10">
              <h2 className="font-bold text-white text-lg mb-2">Analysis defaults</h2>
              <p className="text-muted text-sm mb-5">Choose the starting quality/speed trade-off for new runs.</p>
              <label className="block text-sm text-white">Default analysis mode
                <select value={analysisDefault} onChange={(e) => { setAnalysisDefault(e.target.value); savePreference("verdictlab.analysis.default", e.target.value); }} className="mt-2 w-full max-w-sm bg-ink border border-line rounded-lg px-3 py-2 font-mono text-sm">
                  <option value="balanced">Balanced</option><option value="thorough">Thorough</option><option value="fast">Fast</option>
                </select>
              </label>
            </section>

            <section id="notifications" className="bg-panel border border-line rounded-2xl p-5 sm:p-7 scroll-mt-10">
              <h2 className="font-bold text-white text-lg mb-2">Notifications</h2>
              <label className="flex items-center justify-between gap-4 text-sm text-white">
                <span><b>Run alerts</b><br /><span className="text-muted">Notify me when an analysis finishes or fails.</span></span>
                <input type="checkbox" checked={runAlerts} onChange={(e) => { setRunAlerts(e.target.checked); savePreference("verdictlab.notifications.alerts", String(e.target.checked)); }}/>
              </label>
            </section>

            <section id="appearance" className="bg-panel border border-line rounded-2xl p-5 sm:p-7 scroll-mt-10">
              <h2 className="font-bold text-white text-lg mb-2">Appearance</h2>
              <label className="flex items-center justify-between gap-4 text-sm text-white">
                <span><b>Compact layout</b><br /><span className="text-muted">Use tighter spacing in analysis tables.</span></span>
                <input type="checkbox" checked={compactDensity} onChange={(e) => { setCompactDensity(e.target.checked); savePreference("verdictlab.appearance.compact", String(e.target.checked)); }}/>
              </label>
            </section>

            <section id="data-privacy" className="bg-panel border border-line rounded-2xl p-5 sm:p-7 scroll-mt-10">
              <h2 className="font-bold text-white text-lg mb-2">Data & privacy</h2>
              <p className="text-muted text-sm mb-5">Analyses created from public links are redacted by default and expire automatically. Uploaded files remain available until you delete the analysis.</p>
              <label className="block text-sm text-white">Keep analysis data for
                <select value={retentionDays} onChange={(e) => { setRetentionDays(e.target.value); savePreference("verdictlab.privacy.retention", e.target.value); }} className="mt-2 w-full max-w-sm bg-ink border border-line rounded-lg px-3 py-2 font-mono text-sm">
                  <option value="30">30 days</option><option value="90">90 days</option><option value="365">1 year</option><option value="forever">Until I delete it</option>
                </select>
              </label>
              <p className="text-muted text-xs mt-4">This setting is applied when you start a new public-link analysis. Use Delete account below to remove your account and saved analyses immediately.</p>
            </section>

            <section id="danger-zone" className="bg-alert/5 border border-alert/25 rounded-2xl p-5 sm:p-7 scroll-mt-10">
              <div className="flex items-center gap-2 mb-5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E24C3E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>
                </svg>
                <h2 className="font-bold text-alert text-lg">Danger zone</h2>
              </div>
              <SettingsRow title="Delete account" subtitle="Permanently removes your profile and analysis history" action="Delete" danger onAction={() => setDeleteOpen(true)}/>
            </section>
          </div>
        </div>
      </main>
      </div>

      <LogoutModal open={logoutOpen} busy={signingOut} onCancel={() => setLogoutOpen(false)} onConfirm={confirmLogout}/>

      {token && (<ChangePasswordModal open={passwordOpen} token={token} onClose={() => setPasswordOpen(false)} onSaved={() => {
                setPasswordOpen(false);
                flash("Password updated.");
                getProfile(token).then((p) => {
                    setProfile(p);
                }).catch(() => { });
            }}/>)}

      {token && (<SessionsModal open={sessionsOpen} token={token} sessions={sessions} onClose={() => setSessionsOpen(false)} onRevoked={async () => {
                const s = await listSessions(token);
                setSessions(s);
            }}/>)}

      {token && (<ConfirmModal open={signOutAllOpen} title="Sign out everywhere?" desc="This ends every other active session. You'll stay signed in on this device." confirmLabel="Sign out all" onCancel={() => setSignOutAllOpen(false)} onConfirm={async () => {
                const n = await signOutOtherSessions(token!);
                const s = await listSessions(token!);
                setSessions(s);
                setSignOutAllOpen(false);
                flash(`Signed out of ${n} other session${n === 1 ? "" : "s"}.`);
            }}/>)}

      {token && (<DeleteAccountModal open={deleteOpen} token={token} onClose={() => setDeleteOpen(false)} onDeleted={() => {
                router.push("/");
            }}/>)}
    </div>);
}
function SettingsRow({ title, subtitle, action, onAction, danger, }: {
    title: string;
    subtitle: string;
    action: string;
    onAction: () => void;
    danger?: boolean;
}) {
    return (<div className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="text-white font-semibold text-sm">{title}</p>
        <p className="text-muted text-xs font-mono mt-1">{subtitle}</p>
      </div>
      <button type="button" onClick={onAction} className={danger
            ? "shrink-0 border border-alert/40 text-alert font-mono text-sm font-semibold px-4 py-2 rounded-lg hover:bg-alert/10 transition-colors"
            : "shrink-0 border border-line text-white font-mono text-sm font-semibold px-4 py-2 rounded-lg hover:border-signal hover:text-signal transition-colors"}>
        {action}
      </button>
    </div>);
}
function ModalShell({ open, onClose, children, labelledBy, }: {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
    labelledBy: string;
}) {
    if (!open)
        return null;
    return (<div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={(e) => {
            if (e.target === e.currentTarget)
                onClose();
        }}>
      <div role="dialog" aria-modal="true" aria-labelledby={labelledBy} className="bg-panel border border-line rounded-xl p-6 w-full max-w-md">
        {children}
      </div>
    </div>);
}
function ChangePasswordModal({ open, token, onClose, onSaved, }: {
    open: boolean;
    token: string;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    useEffect(() => {
        if (open) {
            setCurrent("");
            setNext("");
            setConfirm("");
            setErr(null);
        }
    }, [open]);
    async function save() {
        if (next.length < 8)
            return setErr("New password must be at least 8 characters.");
        if (next !== confirm)
            return setErr("New passwords don't match.");
        setBusy(true);
        setErr(null);
        try {
            await changePassword(current, next, token);
            onSaved();
        }
        catch (e) {
            setErr(e instanceof AccountError ? e.message : "Couldn't change your password.");
        }
        finally {
            setBusy(false);
        }
    }
    return (<ModalShell open={open} onClose={onClose} labelledBy="change-password-title">
      <h2 id="change-password-title" className="font-mono font-bold text-white text-lg mb-5">Change password</h2>
      <div className="space-y-4">
        <div>
          <label className="block font-mono text-xs text-muted uppercase tracking-wide mb-2">Current password</label>
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className="w-full bg-ink border border-line rounded-lg px-3 py-2.5 text-white text-sm font-mono outline-none focus:border-signal"/>
        </div>
        <div>
          <label className="block font-mono text-xs text-muted uppercase tracking-wide mb-2">New password</label>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} className="w-full bg-ink border border-line rounded-lg px-3 py-2.5 text-white text-sm font-mono outline-none focus:border-signal"/>
        </div>
        <div>
          <label className="block font-mono text-xs text-muted uppercase tracking-wide mb-2">Confirm new password</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full bg-ink border border-line rounded-lg px-3 py-2.5 text-white text-sm font-mono outline-none focus:border-signal"/>
        </div>
      </div>
      {err && <p className="text-alert text-xs font-mono mt-4">{err}</p>}
      <div className="flex justify-end gap-3 mt-5">
        <button type="button" onClick={onClose} disabled={busy} className="font-mono text-sm text-muted px-4 py-2.5 hover:text-white">
          Cancel
        </button>
        <button type="button" onClick={save} disabled={busy} className="bg-signal text-ink font-mono font-semibold text-sm px-5 py-2.5 rounded-lg disabled:opacity-60">
          {busy ? "Updating…" : "Update password"}
        </button>
      </div>
    </ModalShell>);
}
export default function SettingsRoute() {
    return <Suspense fallback={null}><SettingsPage /></Suspense>;
}
function SessionsModal({ open, token, sessions, onClose, onRevoked, }: {
    open: boolean;
    token: string;
    sessions: SessionInfo[];
    onClose: () => void;
    onRevoked: () => void;
}) {
    const [revokingId, setRevokingId] = useState<string | null>(null);
    async function revoke(id: string) {
        setRevokingId(id);
        try {
            await revokeSession(id, token);
            await onRevoked();
        }
        finally {
            setRevokingId(null);
        }
    }
    return (<ModalShell open={open} onClose={onClose} labelledBy="sessions-title">
      <h2 id="sessions-title" className="font-mono font-bold text-white text-lg mb-4">Active sessions</h2>
      <div className="space-y-3 max-h-80 overflow-y-auto">
        {sessions.map((s) => (<div key={s.id} className="flex items-center justify-between gap-3 border border-line rounded-lg px-3 py-3">
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold flex items-center gap-2">
                {s.device}
                {s.isCurrent && (<span className="text-signal text-[10px] font-mono border border-signal/40 rounded-full px-2 py-0.5">This device</span>)}
              </p>
              <p className="text-muted text-xs font-mono mt-1">Active {timeAgo(s.lastSeen)}</p>
            </div>
            {!s.isCurrent && (<button type="button" onClick={() => revoke(s.id)} disabled={revokingId === s.id} className="shrink-0 text-alert font-mono text-xs font-semibold px-3 py-1.5 border border-alert/30 rounded-lg hover:bg-alert/10 disabled:opacity-60">
                {revokingId === s.id ? "Signing out…" : "Sign out"}
              </button>)}
          </div>))}
      </div>
      <div className="flex justify-end mt-5">
        <button type="button" onClick={onClose} className="font-mono text-sm text-white px-4 py-2.5 border border-line rounded-lg hover:border-signal hover:text-signal">
          Done
        </button>
      </div>
    </ModalShell>);
}
function ConfirmModal({ open, title, desc, confirmLabel, onCancel, onConfirm, }: {
    open: boolean;
    title: string;
    desc: string;
    confirmLabel: string;
    onCancel: () => void;
    onConfirm: () => Promise<void> | void;
}) {
    const [busy, setBusy] = useState(false);
    if (!open)
        return null;
    return (<ModalShell open={open} onClose={onCancel} labelledBy="confirm-title">
      <h2 id="confirm-title" className="font-mono font-bold text-white text-lg mb-2">{title}</h2>
      <p className="text-muted text-sm mb-5">{desc}</p>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} disabled={busy} className="font-mono text-sm text-muted px-4 py-2.5 hover:text-white">
          Cancel
        </button>
        <button type="button" disabled={busy} onClick={async () => {
            setBusy(true);
            await onConfirm();
            setBusy(false);
        }} className="bg-signal text-ink font-mono font-semibold text-sm px-5 py-2.5 rounded-lg disabled:opacity-60">
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </ModalShell>);
}
function DeleteAccountModal({ open, token, onClose, onDeleted, }: {
    open: boolean;
    token: string;
    onClose: () => void;
    onDeleted: () => void;
}) {
    const [password, setPassword] = useState("");
    const [confirmText, setConfirmText] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    useEffect(() => {
        if (open) {
            setPassword("");
            setConfirmText("");
            setErr(null);
        }
    }, [open]);
    async function doDelete() {
        if (confirmText !== "DELETE")
            return setErr('Type "DELETE" to confirm.');
        setBusy(true);
        setErr(null);
        try {
            await deleteAccount(password, token);
            onDeleted();
        }
        catch (e) {
            setErr(e instanceof AccountError ? e.message : "Couldn't delete your account.");
        }
        finally {
            setBusy(false);
        }
    }
    return (<ModalShell open={open} onClose={onClose} labelledBy="delete-account-title">
      <h2 id="delete-account-title" className="font-mono font-bold text-alert text-lg mb-2">Delete account</h2>
      <p className="text-muted text-sm mb-5">
        This permanently deletes your profile and can't be undone. Enter your password and type
        <span className="text-white font-mono"> DELETE </span> to confirm.
      </p>
      <label className="block font-mono text-xs text-muted uppercase tracking-wide mb-2">Password</label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-ink border border-line rounded-lg px-3 py-2.5 text-white text-sm font-mono outline-none focus:border-alert mb-4"/>
      <label className="block font-mono text-xs text-muted uppercase tracking-wide mb-2">Type DELETE to confirm</label>
      <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="w-full bg-ink border border-line rounded-lg px-3 py-2.5 text-white text-sm font-mono outline-none focus:border-alert mb-4"/>
      {err && <p className="text-alert text-xs font-mono mb-4">{err}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} disabled={busy} className="font-mono text-sm text-muted px-4 py-2.5 hover:text-white">
          Cancel
        </button>
        <button type="button" onClick={doDelete} disabled={busy} className="bg-alert text-white font-mono font-semibold text-sm px-5 py-2.5 rounded-lg disabled:opacity-60">
          {busy ? "Deleting…" : "Delete my account"}
        </button>
      </div>
    </ModalShell>);
}
