"use client";
import type { KindCounts, KindFilter } from "@/lib/recordKind";
export const conflicts = ["Israel-Gaza", "US-Iran"];
export type AnalysisFilterState = {
    selectedConflicts: string[];
    selectedSubreddits: string[];
    startDate: string;
    endDate: string;
    keyword: string;
    kind?: KindFilter;
};
type AnalysisFiltersProps = {
    filters: AnalysisFilterState;
    onChange: (filters: AnalysisFilterState) => void;
    defaults?: Partial<AnalysisFilterState>;
    subredditOptions?: string[];
    conflictOptions?: string[];
    kindCounts?: KindCounts;
};
export default function AnalysisFilters({ filters, onChange, defaults, subredditOptions, conflictOptions, kindCounts }: AnalysisFiltersProps) {
    const subredditList = subredditOptions ?? [];
    const conflictList = conflictOptions ?? [];
    const showKind = !!kindCounts && kindCounts.post > 0 && kindCounts.comment > 0;
    const currentKind: KindFilter = filters.kind ?? "all";
    const toggle = (key: "selectedConflicts" | "selectedSubreddits", value: string) => {
        const current = filters[key];
        onChange({ ...filters, [key]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value] });
    };
    const reset = () => onChange({ selectedConflicts: conflictList, selectedSubreddits: [], startDate: "", endDate: "", keyword: "", kind: "all", ...defaults });
    const chips = (label: string, key: "selectedConflicts" | "selectedSubreddits", options: string[]) => (<div className="fbar-set" role="group" aria-label={label}>
      <span className="fbar-label">{label}</span>
      <div className="fbar-chips">
        {options.map((option) => (<button key={option} type="button" className="fbar-chip" aria-pressed={filters[key].includes(option)} onClick={() => toggle(key, option)}>
            {option}
          </button>))}
      </div>
    </div>);
    const kindOptions: {
        value: KindFilter;
        label: string;
    }[] = [
        { value: "all", label: "All" },
        { value: "post", label: `Posts · ${(kindCounts?.post ?? 0).toLocaleString()}` },
        { value: "comment", label: `Comments · ${(kindCounts?.comment ?? 0).toLocaleString()}` },
    ];
    const kindChips = (<div className="fbar-set" role="group" aria-label="Type">
      <span className="fbar-label">TYPE</span>
      <div className="fbar-chips">
        {kindOptions.map((option) => (<button key={option.value} type="button" className="fbar-chip" aria-pressed={currentKind === option.value} onClick={() => onChange({ ...filters, kind: option.value })}>
            {option.label}
          </button>))}
      </div>
    </div>);
    return (<section className="fbar">
      {(conflictList.length > 0 || subredditList.length > 0 || showKind) && (<div className="fbar-scope">
          {showKind && kindChips}
          {conflictList.length > 0 && chips("CONFLICT", "selectedConflicts", conflictList)}
          {subredditList.length > 0 && chips("SUBREDDITS", "selectedSubreddits", subredditList)}
        </div>)}

      <div className="fbar-controls">
        <div className="fbar-dates" role="group" aria-label="Date range">
          <span className="fbar-label">DATE RANGE</span>
          <input type="date" value={filters.startDate} max={filters.endDate} onChange={(event) => onChange({ ...filters, startDate: event.target.value })} aria-label="Start date"/>
          <span className="fbar-arrow" aria-hidden="true">→</span>
          <input type="date" value={filters.endDate} min={filters.startDate} onChange={(event) => onChange({ ...filters, endDate: event.target.value })} aria-label="End date"/>
        </div>

        <label className="fbar-search">
          <span aria-hidden="true">⌕</span>
          <input type="text" value={filters.keyword} onChange={(event) => onChange({ ...filters, keyword: event.target.value })} placeholder="Keyword, e.g. battery" aria-label="Keyword"/>
        </label>

        <button className="fbar-reset" type="button" onClick={reset}>
          <span aria-hidden="true">↶</span> Reset
        </button>
      </div>
    </section>);
}
