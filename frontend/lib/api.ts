const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
const SESSION_TOKEN_KEY = "pulse_session_token";
const LAST_RUN_KEY = "pulse_last_run";
function authHeader(): Record<string, string> {
    if (typeof window === "undefined")
        return {};
    const token = window.localStorage.getItem(SESSION_TOKEN_KEY);
    return token ? { Authorization: "Bearer " + token } : {};
}
export function getLastRunId(): string | null {
    if (typeof window === "undefined")
        return null;
    return window.localStorage.getItem(LAST_RUN_KEY);
}
export function setLastRunId(id: string) {
    if (typeof window !== "undefined")
        window.localStorage.setItem(LAST_RUN_KEY, id);
}
export function clearLastRunId() {
    if (typeof window !== "undefined")
        window.localStorage.removeItem(LAST_RUN_KEY);
}
export type Stage = {
    label: string;
    progress: number;
    status: "queued" | "running" | "done";
};
export type Analysis = {
    id: string;
    title: string;
    source_type: string;
    source_url: string | null;
    status: "queued" | "running" | "complete" | "failed";
    stages: Record<string, Stage>;
    error: string | null;
    records_in: number;
    quality_score: number | null;
    created_at: string;
    updated_at: string;
    is_demo?: boolean;
};
export type AnalysisResults = {
    id: string;
    status: string;
    result_summary: {
        total_records: number;
        records_after_dedup: number;
        dedup_rate_pct: number;
        sentiment_breakdown: {
            positive: number;
            neutral: number;
            negative: number;
        };
        avg_vader_score: number;
        avg_textblob_score: number;
        avg_source_polarity?: number;
        top_conflict?: string;
        dominant_emotion?: string;
        most_volatile_day?: string;
        most_volatile_spread?: number;
        top_topics: string[];
        quality_score: number | null;
        data_quality?: {
            records_in: number;
            records_after_dedup: number;
            dedup_rate_pct: number;
            interpretation: string;
        };
        polarity_trend?: number[];
        trend_dates?: string[];
        volume_trend?: number[];
        subreddits?: {
            name: string;
            count: number;
        }[];
        kind_breakdown?: Partial<Record<"post" | "comment" | "unknown", {
            count: number;
            avg_polarity: number;
            positive: number;
            neutral: number;
            negative: number;
        }>>;
        scoring?: {
            senticnet_usable_pct: number;
            mean_concept_coverage_pct: number;
            records_vader_fallback: number;
            min_coverage_threshold_pct: number;
        };
        trust_benchmark?: {
            labelled_records: number;
            accuracy_pct: {
                senticnet: number;
                vader: number;
                textblob: number;
            };
            sarcasm_failure: {
                text: string;
                human_label: string;
                predictions: {
                    senticnet: string;
                    vader: string;
                    textblob: string;
                };
            };
        };
        evaluation?: {
            status: "not_configured" | "configured";
            message?: string;
        };
    } | null;
    result_records: {
        text: string;
        vader_score: number;
        textblob_score: number;
        source_polarity: number;
        source_label?: string;
        event_date?: string;
        event_time?: string | null;
        conflict?: string;
        subreddit?: string | null;
        upvotes?: number | null;
        emotion?: string | null;
        kind?: "post" | "comment" | "unknown" | null;
        label: string;
        explanation: string;
    }[] | null;
};
export async function startAnalysis(params: {
    source_type: "reddit" | "youtube" | "csv";
    source_url?: string;
    title?: string;
    file?: File;
    privacy_mode?: "redacted" | "raw";
    consent_public_data?: boolean;
    retention_days?: 30 | 90 | 365;
}): Promise<Analysis> {
    const form = new FormData();
    form.append("source_type", params.source_type);
    if (params.source_url)
        form.append("source_url", params.source_url);
    if (params.title)
        form.append("title", params.title);
    if (params.file)
        form.append("file", params.file);
    form.append("privacy_mode", params.privacy_mode ?? "redacted");
    form.append("consent_public_data", String(params.consent_public_data ?? false));
    if (params.retention_days)
        form.append("retention_days", String(params.retention_days));
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    let res: Response;
    try {
        res = await fetch(`${API_BASE}/analyses`, { method: "POST", body: form, headers: authHeader(), signal: controller.signal });
    }
    catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            throw new Error("The analysis service did not respond. Start the backend on port 8000 and try again.");
        }
        throw new Error("The analysis service is unavailable. Start the backend on port 8000 and try again.");
    }
    finally {
        window.clearTimeout(timeout);
    }
    if (!res.ok)
        throw new Error(await res.text());
    const created: Analysis = await res.json();
    setLastRunId(created.id);
    return created;
}
export async function getAnalysis(id: string): Promise<Analysis> {
    const res = await fetch(`${API_BASE}/analyses/${id}`, { cache: "no-store", headers: authHeader() });
    if (!res.ok)
        throw new AccountError(await res.text(), res.status);
    return res.json();
}
export async function getDemoSample(): Promise<Analysis> {
    const res = await fetch(`${API_BASE}/analyses/demo/sample`, { cache: "no-store" });
    if (!res.ok)
        throw new AccountError(await res.text(), res.status);
    return res.json();
}
export async function getResults(id: string): Promise<AnalysisResults> {
    const res = await fetch(`${API_BASE}/analyses/${id}/results`, { cache: "no-store", headers: authHeader() });
    if (!res.ok)
        throw new AccountError(await res.text(), res.status);
    return res.json();
}
export async function getReport(id: string): Promise<{
    id: string;
    report_markdown: string;
}> {
    const res = await fetch(`${API_BASE}/analyses/${id}/report`, { cache: "no-store", headers: authHeader() });
    if (!res.ok)
        throw new AccountError(await res.text(), res.status);
    return res.json();
}
export async function listAnalyses(): Promise<Analysis[]> {
    const res = await fetch(`${API_BASE}/analyses`, { cache: "no-store", headers: authHeader() });
    if (!res.ok)
        throw new AccountError(await res.text(), res.status);
    return res.json();
}
export async function deleteAnalysis(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/analyses/${id}`, { method: "DELETE", headers: authHeader() });
    if (!res.ok)
        throw new AccountError(await res.text(), res.status);
    if (getLastRunId() === id)
        clearLastRunId();
}
export async function findSavedRun(): Promise<string | null> {
    const stored = getLastRunId();
    if (stored) {
        try {
            const a = await getAnalysis(stored);
            if (a.status !== "failed" && !a.is_demo)
                return a.id;
            clearLastRunId();
        }
        catch (e) {
            if (e instanceof AccountError && (e.status === 404 || e.status === 401))
                clearLastRunId();
            else if (!(e instanceof AccountError))
                throw e;
        }
    }
    const rows = await listAnalyses();
    const pick = rows.find((r) => r.status === "complete") ??
        rows.find((r) => r.status === "running" || r.status === "queued");
    return pick ? pick.id : null;
}
export class AccountError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
        super(message);
        this.status = status;
    }
}
function readableDetail(data: any): string {
    const detail = data?.detail;
    if (typeof detail === "string" && detail)
        return detail;
    if (Array.isArray(detail) && detail.length) {
        return detail.map((d: any) => d?.msg).filter(Boolean).join(" ") || "Please check what you entered.";
    }
    return "Something went wrong. Please try again.";
}
async function authFetch(path: string, body?: unknown, token?: string): Promise<any> {
    let res: Response;
    try {
        res = await fetch(`${API_BASE}${path}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        });
    }
    catch {
        throw new AccountError(`Can't reach the server at ${API_BASE}. Make sure the backend is running, then try again.`);
    }
    let data: any = null;
    try {
        data = await res.json();
    }
    catch {
    }
    if (!res.ok) {
        throw new AccountError(readableDetail(data), res.status);
    }
    return data;
}
export type SignupResult = {
    email: string;
    delivered: boolean;
    devCode?: string;
};
export type AuthResult = {
    token: string;
    userId: string;
    email: string;
};
export async function requestAccountVerification(email: string, password: string): Promise<SignupResult> {
    const data = await authFetch("/auth/signup", { email, password });
    return { email: data.email, delivered: data.delivered, devCode: data.dev_code ?? undefined };
}
export async function resendVerificationCode(email: string): Promise<SignupResult> {
    const data = await authFetch("/auth/resend-code", { email });
    return { email: data.email, delivered: data.delivered, devCode: data.dev_code ?? undefined };
}
export async function confirmAccountVerification(email: string, code: string): Promise<AuthResult> {
    const data = await authFetch("/auth/verify", { email, code });
    storeSession(data.token);
    return { token: data.token, userId: data.user_id, email: data.email };
}
export async function signIn(email: string, password: string): Promise<AuthResult> {
    const data = await authFetch("/auth/login", { email, password });
    storeSession(data.token);
    return { token: data.token, userId: data.user_id, email: data.email };
}
export async function signOut(allDevices: boolean = false): Promise<void> {
    const token = getCurrentSessionToken();
    if (token) {
        try {
            await authFetch("/auth/logout", { all_devices: allDevices }, token);
        }
        catch {
        }
    }
    if (typeof window !== "undefined") {
        window.localStorage.removeItem(SESSION_TOKEN_KEY);
        window.localStorage.removeItem(LAST_RUN_KEY);
    }
}
export function getCurrentSessionToken(): string | null {
    if (typeof window === "undefined")
        return null;
    return window.localStorage.getItem(SESSION_TOKEN_KEY);
}
function storeSession(token: string) {
    if (typeof window !== "undefined")
        window.localStorage.setItem(SESSION_TOKEN_KEY, token);
}
export type Profile = {
    userId: string;
    email: string;
    name: string | null;
    institution: string | null;
    role: string | null;
    researchFocus: string | null;
    twoFactorEnabled: boolean;
    createdAt: string;
    passwordChangedAt: string;
};
export type SessionInfo = {
    id: string;
    device: string;
    createdAt: string;
    lastSeen: string;
    isCurrent: boolean;
};
async function authRequest(method: string, path: string, body?: unknown, token?: string): Promise<any> {
    let res: Response;
    try {
        res = await fetch(`${API_BASE}${path}`, {
            method,
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    }
    catch {
        throw new AccountError(`Can't reach the server at ${API_BASE}. Make sure the backend is running, then try again.`);
    }
    let data: any = null;
    try {
        data = await res.json();
    }
    catch {
    }
    if (!res.ok) {
        throw new AccountError(readableDetail(data), res.status);
    }
    return data;
}
function toProfile(d: any): Profile {
    return {
        userId: d.user_id,
        email: d.email,
        name: d.name,
        institution: d.institution ?? null,
        role: d.role ?? null,
        researchFocus: d.research_focus ?? null,
        twoFactorEnabled: !!d.two_factor_enabled,
        createdAt: d.created_at,
        passwordChangedAt: d.password_changed_at,
    };
}
export async function getProfile(token: string): Promise<Profile> {
    return toProfile(await authRequest("GET", "/auth/profile", undefined, token));
}
export type ProfileUpdate = {
    name?: string;
    institution?: string;
    role?: string;
    researchFocus?: string;
};
export async function updateProfile(patch: ProfileUpdate, token: string): Promise<Profile> {
    return toProfile(await authRequest("PATCH", "/auth/profile", {
        name: patch.name,
        institution: patch.institution,
        role: patch.role,
        research_focus: patch.researchFocus,
    }, token));
}
export async function changePassword(currentPassword: string, newPassword: string, token: string): Promise<void> {
    await authRequest("POST", "/auth/change-password", { current_password: currentPassword, new_password: newPassword }, token);
}
export async function updateTwoFactor(enabled: boolean, password: string, token: string): Promise<Profile> {
    const d = await authRequest("POST", "/auth/two-factor", { enabled, password }, token);
    return {
        userId: d.user_id,
        email: d.email,
        name: d.name,
        institution: d.institution,
        role: d.role,
        researchFocus: d.research_focus,
        twoFactorEnabled: !!d.two_factor_enabled,
        createdAt: d.created_at,
        passwordChangedAt: d.password_changed_at,
    };
}
export async function listSessions(token: string): Promise<SessionInfo[]> {
    const rows = await authRequest("GET", "/auth/sessions", undefined, token);
    return rows.map((s: any) => ({ id: s.id, device: s.device, createdAt: s.created_at, lastSeen: s.last_seen, isCurrent: s.is_current }));
}
export async function revokeSession(id: string, token: string): Promise<void> {
    await authRequest("DELETE", `/auth/sessions/${encodeURIComponent(id)}`, undefined, token);
}
export async function signOutOtherSessions(token: string): Promise<number> {
    const d = await authRequest("POST", "/auth/sessions/revoke-others", undefined, token);
    return d.revoked ?? 0;
}
export async function deleteAccount(password: string, token: string): Promise<void> {
    await authRequest("DELETE", "/auth/account", { password }, token);
}
export type LiveResult = {
    text_length: number;
    senticnet: number | null;
    vader: number;
    textblob: number;
    hourglass: {
        pleasantness: number;
        attention: number;
        sensitivity: number;
        aptitude: number;
    };
    dominant_emotion: "pleasantness" | "attention" | "sensitivity" | "aptitude";
    label: "positive" | "neutral" | "negative";
    coverage_pct: number;
    coverage_threshold_pct: number;
    fell_back_to_vader: boolean;
    senticnet_available: boolean;
    coverage_source: "senticnet";
};
export async function analyseLive(text: string, signal?: AbortSignal): Promise<LiveResult> {
    let res: Response;
    try {
        res = await fetch(`${API_BASE}/live`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
            signal,
        });
    }
    catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
            throw error;
        throw new Error("The analysis service is unavailable. Start the backend on port 8000 and try again.");
    }
    if (!res.ok) {
        let message = "Could not analyse that text. Please try again.";
        try {
            const data = await res.json();
            if (typeof data?.detail === "string")
                message = data.detail;
        }
        catch {
        }
        throw new AccountError(message, res.status);
    }
    return res.json();
}
