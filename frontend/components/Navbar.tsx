export default function Navbar() {
    return (<header className="flex items-center justify-between px-5 py-4 sm:px-10 sm:py-5 border-b border-line">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 bg-signal text-ink font-bold flex items-center justify-center rounded-sm">
          V
        </div>
        <span className="font-semibold tracking-tight text-lg">
          VERDICT<span className="text-signal">LAB</span>
        </span>
        <span className="hidden sm:inline text-xs text-muted font-mono ml-2">

        </span>
      </div>

      <a href="/workspace/access" className="bg-signal text-ink font-medium text-sm px-4 py-2.5 sm:px-5 rounded-sm hover:brightness-95 transition whitespace-nowrap shrink-0">
        Open workspace →
      </a>
    </header>);
}
