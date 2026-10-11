export function isDemoPath(pathname: string | null): boolean {
    return pathname === "/demo" || pathname?.startsWith("/demo/") === true;
}
