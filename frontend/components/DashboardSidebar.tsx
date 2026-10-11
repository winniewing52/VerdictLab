"use client";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentSessionToken, signOut } from "@/lib/api";
import LogoutModal from "@/components/LogoutModal";
import DemoBadge from "@/components/DemoBadge";
import { isDemoPath } from "@/lib/demo";
const STORAGE_KEY = "verdictlab.sidebar.open";
const MOBILE_QUERY = "(max-width: 1024px)";
let sidebarOpen: boolean | null = null;
const listeners = new Set<() => void>();
const isMobile = () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches;
function persistedOpen(): boolean {
    try {
        return window.localStorage.getItem(STORAGE_KEY) !== "closed";
    }
    catch {
        return true;
    }
}
function readInitial(): boolean {
    if (isMobile())
        return false;
    return persistedOpen();
}
function getSnapshot(): boolean {
    if (sidebarOpen === null)
        sidebarOpen = readInitial();
    return sidebarOpen;
}
const getServerSnapshot = () => true;
function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
function setSidebarOpen(next: boolean, persist = true) {
    sidebarOpen = next;
    if (persist) {
        try {
            window.localStorage.setItem(STORAGE_KEY, next ? "open" : "closed");
        }
        catch {
        }
    }
    listeners.forEach((listener) => listener());
}
function NavItem({ href, className, onNavigate, children }: {
    href: string;
    className: string;
    onNavigate: () => void;
    children: ReactNode;
}) {
    return href.startsWith("/")
        ? <Link className={className} href={href} onClick={onNavigate}>{children}</Link>
        : <a className={className} href={href} onClick={onNavigate}>{children}</a>;
}
export default function DashboardSidebar({ active = "Pulse", runId }: {
    active?: string;
    runId?: string | null;
}) {
    const router = useRouter();
    const demoMode = isDemoPath(usePathname());
    const open = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const setOpen = (next: boolean) => setSidebarOpen(next, !isMobile());
    const closeOnMobile = () => {
        if (isMobile())
            setSidebarOpen(false, false);
    };
    const [signingOut, setSigningOut] = useState(false);
    const [logoutOpen, setLogoutOpen] = useState(false);
    const [email, setEmail] = useState<string | null>(null);
    const [hydrated, setHydrated] = useState(false);
    useEffect(() => {
        setEmail(getCurrentSessionToken() ? "Signed in" : null);
        setHydrated(true);
    }, []);
    useEffect(() => {
        const query = window.matchMedia(MOBILE_QUERY);
        const onChange = (event: MediaQueryListEvent) => setSidebarOpen(event.matches ? false : persistedOpen(), false);
        query.addEventListener("change", onChange);
        return () => query.removeEventListener("change", onChange);
    }, []);
    useEffect(() => {
        if (!open || !isMobile())
            return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (event: KeyboardEvent) => { if (event.key === "Escape")
            setSidebarOpen(false, false); };
        window.addEventListener("keydown", onKey);
        return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKey); };
    }, [open]);
    const root = demoMode ? "/demo" : "/workspace";
    const link = (segment: string) => {
        const path = segment ? `${root}/${segment}` : root;
        return !demoMode && runId ? `${path}?run=${encodeURIComponent(runId)}` : path;
    };
    const navigation = [
        { label: "Pulse", icon: "pulse", href: link("") },
        { label: "Timeline", icon: "timeline", href: link("timeline") },
        { label: "Emotions", icon: "emotions", href: link("emotions") },
        { label: "Compare", icon: "compare", href: link("compare") },
        { label: "Explorer", icon: "explorer", href: link("explorer") },
    ];
    const research = [
        { label: "Event Impact", icon: "impact", href: "#impact" },
        { label: "Model Agreement", icon: "agreement", href: "#agreement" },
        { label: "Echo Chamber", icon: "echo", href: "#echo" },
        { label: "Live Analyser", icon: "live", href: link("live") },
    ];
    const about = [
        { label: "Methodology", icon: "methodology", href: "#methodology" },
        { label: "Ethics & Limits", icon: "ethics", href: "#ethics" },
    ];
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
    const renderLinks = (items: typeof navigation) => items.map((item) => (<NavItem className={`nav-item${item.label === active ? " active" : ""}`} href={item.href} key={item.label} onNavigate={closeOnMobile}>
      <span className="nav-icon" aria-hidden="true"><NavGlyph name={item.icon}/></span>
      <span>{item.label}</span>
    </NavItem>));
    return <>
    {!open && (<div className="mobile-bar">
        <button className="sidebar-open-button" type="button" onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={false}><NavGlyph name="menu"/></button>
        <span className="mobile-bar-brand" aria-hidden="true"><b>VL</b> VerdictLab</span>
      </div>)}
    <aside className={`dashboard-sidebar${open ? " is-open" : " is-closed"}${hydrated ? " is-hydrated" : ""}`} aria-label="VerdictLab navigation">
      <div className="brand-lockup">
        <div className="brand-mark">VL</div>
        <div><strong>VerdictLab</strong><span>MDS05 · SENTICNET 7</span></div>
        <button className="sidebar-close-button" type="button" onClick={() => setOpen(false)} aria-label="Close navigation">×</button>
      </div>
      <nav>
        <NavItem className="nav-item" href={demoMode ? "/workspace/access" : "/workspace/list"} onNavigate={closeOnMobile}>
        <span className="nav-icon" aria-hidden="true"><NavGlyph name="explorer"/></span>
        <span>{demoMode ? "Analyse your own data" : "All workspaces"}</span>
        </NavItem>
        <p className="nav-label">Dashboard</p>
        {renderLinks(navigation)}
        <p className="nav-label research-label">Research</p>
        {renderLinks(research)}
        <p className="nav-label about-label">About</p>
        {renderLinks(about)}
      </nav>
      {!demoMode && (<div className="sidebar-account">
          <NavItem className={`nav-item${active === "Settings" ? " active" : ""}`} href={runId ? `/workspace/settings?run=${encodeURIComponent(runId)}` : "/workspace/settings"} onNavigate={closeOnMobile}>
            <span className="nav-icon" aria-hidden="true"><NavGlyph name="settings"/></span>
            <span>Settings</span>
          </NavItem>
          <button className="nav-item logout-item" type="button" onClick={() => setLogoutOpen(true)} disabled={signingOut}>
            <span className="nav-icon" aria-hidden="true"><NavGlyph name="logout"/></span>
            <span>{signingOut ? "Signing out…" : "Log out"}</span>
          </button>
        </div>)}
      <div className="sidebar-footer">
        {email && <span className="sidebar-status"><i className="status-dot"/>{email}</span>}
        v0.9 · build mds05<br />Monash EET3163/EET3164
      </div>
    </aside>
    {open && hydrated && <button className="sidebar-backdrop" type="button" onClick={() => setOpen(false)} aria-label="Close navigation"/>}

    {demoMode && <DemoBadge />}

    <LogoutModal open={logoutOpen} busy={signingOut} onCancel={() => setLogoutOpen(false)} onConfirm={confirmLogout}/>
  </>;
}
function NavGlyph({ name }: {
    name: string;
}) {
    const common = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
    switch (name) {
        case "pulse":
            return <svg {...common}><path d="M3 12h4l2-7 4 14 2-7h6"/></svg>;
        case "timeline":
            return <svg {...common}><circle cx="5" cy="12" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="19" cy="17" r="2"/><path d="M6.6 10.8 10.6 7M13.3 7.4l4.1 8.2"/></svg>;
        case "emotions":
            return <svg {...common}><circle cx="12" cy="12" r="8"/><path d="M9 10h.01M15 10h.01M8.5 15c1 1 2.2 1.5 3.5 1.5s2.5-.5 3.5-1.5"/></svg>;
        case "compare":
            return <svg {...common}><path d="M8 4v16M16 4v16M4 9l4-4 4 4M20 15l-4 4-4-4"/></svg>;
        case "explorer":
            return <svg {...common}><rect x="3.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.2"/></svg>;
        case "impact":
            return <svg {...common}><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>;
        case "agreement":
            return <svg {...common}><path d="M12 3v18M5 7l-3 6a3.5 3.5 0 0 0 7 0zM19 7l-3 6a3.5 3.5 0 0 0 7 0zM5 7h14"/></svg>;
        case "echo":
            return <svg {...common}><circle cx="12" cy="12" r="2.5"/><circle cx="12" cy="12" r="6.5" strokeDasharray="2 3"/><circle cx="12" cy="12" r="10.5" strokeDasharray="2 3"/></svg>;
        case "live":
            return <svg {...common}><circle cx="12" cy="12" r="2.5"/><path d="M7 7a7 7 0 0 0 0 10M17 7a7 7 0 0 1 0 10M4 4a11 11 0 0 0 0 16M20 4a11 11 0 0 1 0 16"/></svg>;
        case "methodology":
            return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>;
        case "ethics":
            return <svg {...common}><path d="M12 3 4 6v6c0 4.5 3.4 7.5 8 9 4.6-1.5 8-4.5 8-9V6z"/></svg>;
        case "settings":
            return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.5V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.5 1H20a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;
        case "logout":
            return <svg {...common}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>;
        case "menu":
            return <svg {...common} width={20} height={20}><path d="M4 6h16M4 12h16M4 18h16"/></svg>;
        default:
            return null;
    }
}
