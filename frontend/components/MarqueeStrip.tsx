const TAGS = [
    "VADER",
    "TEXTBLOB",
    "SENTICNET",
    "DOMAIN MODEL V2",
    "HUMAN-IN-THE-LOOP",
    "EVENT CORRELATION",
    "TOPIC DISCOVERY",
    "EXPLAINABLE AI",
];
function TagRow() {
    return (<div className="flex shrink-0 gap-10 pr-10">
      {TAGS.map((tag) => (<span key={tag} className="flex items-center gap-10">
          {tag}
          <span className="text-line">·</span>
        </span>))}
    </div>);
}
export default function MarqueeStrip() {
    return (<div className="border-y border-line bg-panel/40 py-5 overflow-hidden">
      <div className="flex w-max animate-marquee font-mono text-xs text-muted whitespace-nowrap">
        {[0, 1].map((n) => (<TagRow key={n}/>))}
      </div>
    </div>);
}
