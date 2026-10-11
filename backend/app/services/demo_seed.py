from __future__ import annotations

import csv
import io
import logging
import threading

from ..database import SessionLocal
from ..models import Analysis
from . import sentic

logger = logging.getLogger("verdictlab.demo")

DEMO_SOURCE_URL = "demo://verdictlab/synthetic-sample"
DEMO_TITLE = "Synthetic sample: reactions to a congestion charge (demo data)"
DEMO_FILENAME = "synthetic_sample.csv"

_STAGES = {
    "collecting_content": {"label": "Collecting content", "progress": 0, "status": "queued"},
    "cleaning_dedup": {"label": "Cleaning & dedup", "progress": 0, "status": "queued"},
    "model_comparison": {"label": "Model comparison", "progress": 0, "status": "queued"},
}

_COMMENTS = [
    ("post", "The city council just approved a congestion charge for the downtown core. What do you all think?", 412),
    ("comment", "Honestly this is long overdue. The air quality downtown is terrible and the buses finally get a fair chance.", 198),
    ("comment", "Great, another tax on people who just want to get to work. Thanks a lot, council.", 143),
    ("comment", "I love the idea in theory, but the public transport out here is awful. What are we supposed to do?", 121),
    ("comment", "London did this years ago and traffic dropped. It works, people just hate change.", 96),
    ("comment", "Oh sure, because charging commuters has never backfired before. Brilliant plan.", 88),
    ("comment", "The charge starts in January and covers weekdays from 7am to 7pm.", 40),
    ("comment", "Small shops downtown are terrified. Fewer customers driving in means fewer sales, simple as that.", 77),
    ("comment", "My commute got faster in the pilot week. I was ready to hate it and I actually enjoyed it.", 65),
    ("comment", "This is a disaster waiting to happen and everyone knows it.", 59),
    ("comment", "Revenue is supposed to fund new bus lanes and cycle paths, which is a reasonable trade.", 52),
    ("comment", "I can't afford this. I work two jobs and the car is the only way I can make both shifts.", 150),
    ("comment", "There are exemptions for low-income drivers and disabled badge holders, check the council page.", 71),
    ("comment", "Wonderful news for anyone who walks or cycles here. The streets will feel so much safer.", 83),
    ("post", "Pilot data from the first month of the congestion charge is out. Traffic is down, but opinions are split.", 305),
    ("comment", "Traffic down 14 percent is a clear win. Cleaner air, quieter streets, I am thrilled.", 112),
    ("comment", "Of course the numbers look good when you pick the month with school holidays.", 94),
    ("comment", "I don't trust these figures. Who measured them and how?", 61),
    ("comment", "The report lists the method on page four. It used sensor counts at 22 junctions.", 38),
    ("comment", "Delivery drivers are being hit hardest and nobody seems to care about that.", 69),
    ("comment", "Prices at my local grocer already went up because of the new delivery fee. Unbelievable.", 57),
    ("comment", "Public transport got more frequent on three routes. That is a real improvement for me.", 49),
    ("comment", "Meh. Nothing changed for me either way.", 12),
    ("comment", "The whole thing feels rushed. They should have fixed the buses first and charged later.", 90),
    ("comment", "Totally agree, sequencing matters. But I'd still rather have the charge than the gridlock we had.", 47),
    ("comment", "Brilliant. Now the rich can still drive and everyone else gets squeezed. So fair.", 104),
    ("comment", "Hospital staff on night shifts have no safe way home without a car. That needs fixing.", 85),
    ("comment", "Night shift workers are exempt after 7pm, that's in the rules.", 33),
    ("comment", "Cycling to work now. Saved money, feel healthier, and the roads are calmer. Love it.", 74),
    ("comment", "I am furious. Nobody asked residents and the consultation was a joke.", 131),
    ("post", "Three months in: what has the congestion charge actually changed for you?", 268),
    ("comment", "Bus ridership is up and my journey is ten minutes shorter. Genuinely pleased.", 92),
    ("comment", "Still hate it. Still paying it. Still no better bus where I live.", 101),
    ("comment", "Shops near the edge of the zone seem busier, which I did not expect.", 44),
    ("comment", "My business lost a few customers, but the footfall from people on foot has helped a bit.", 58),
    ("comment", "Fine by me. It was going to happen sooner or later.", 21),
    ("comment", "The congestion charge is a scam dressed up as environmentalism.", 66),
    ("comment", "Air quality sensors show a clear improvement near the school. That alone makes it worth it for me.", 117),
    ("comment", "Great for the environment, terrible for my wallet. I feel torn about it.", 79),
    ("comment", "The council published an interim report; it is long and mostly tables.", 18),
    ("comment", "Everything about this rollout has been a mess, from the signs to the payment app.", 82),
    ("comment", "The payment app crashed twice and I got fined anyway. Absolutely ridiculous.", 97),
    ("comment", "Support refunded my fine within a day, which was better than I expected.", 54),
    ("comment", "Kids can finally cross the road outside school without the usual wall of idling cars. Wonderful.", 126),
    ("comment", "I will never forgive them for this.", 36),
    ("comment", "Honestly it's fine. I pay it twice a month and it's not the end of the world.", 41),
    ("comment", "Compared with what we pay for parking this is nothing. People are overreacting.", 62),
    ("comment", "Overreacting? Some of us do not have a choice. Easy to say when you live on the tram line.", 87),
    ("comment", "Fair point. The policy needs more help for people with no alternative.", 56),
    ("comment", "Good discussion here, both sides make fair points.", 29),
]

def _build_csv() -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["text", "created_time", "subreddit", "kind", "upvotes"])
    for index, (kind, text, upvotes) in enumerate(_COMMENTS):
        day = 1 + index // 5          # 5 comments per day, 10 days
        hour = 7 + (index * 3) % 14   # spread across the day
        minute = (index * 17) % 60
        stamp = f"2026-03-{day:02d}T{hour:02d}:{minute:02d}:00"
        writer.writerow([text, stamp, "synthetic_demo", kind, upvotes])
    return buffer.getvalue().encode("utf-8")

_lock = threading.Lock()

def ensure_demo_analysis() -> None:
    """Make sure a completed public demo exists. Safe to call on every start-up."""
    if not sentic.available():
        logger.warning("Demo sample not created: SenticNet is unavailable (%s)", sentic.load_error())
        return

    from .pipeline import run_pipeline

    with _lock:
        db = SessionLocal()
        try:
            demos = db.query(Analysis).filter(Analysis.is_demo == 1).all()
            if any(a.status in ("complete", "running", "queued") for a in demos):
                return
            for stale in demos:
                db.delete(stale)
            analysis = Analysis(
                user_id=None,
                title=DEMO_TITLE,
                source_type="csv",
                source_url=DEMO_SOURCE_URL,
                uploaded_filename=DEMO_FILENAME,
                privacy_mode="redacted",
                consent_public_data=0,
                retention_days=None,
                stages=_STAGES,
                status="queued",
                is_demo=1,
            )
            db.add(analysis)
            db.commit()
            analysis_id = analysis.id
        finally:
            db.close()

        run_pipeline(analysis_id, _build_csv(), DEMO_FILENAME)
        logger.info("Demo sample created (%s)", analysis_id)

def start_demo_seed_thread() -> threading.Thread:
    """Build the demo in the background so the API is reachable while the lexicon loads."""

    def run() -> None:
        try:
            ensure_demo_analysis()
        except Exception:
            logger.exception("Could not create the demo sample")

    thread = threading.Thread(target=run, name="demo-seed", daemon=True)
    thread.start()
    return thread
