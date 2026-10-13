# VerdictLab

VerdictLab is a research dashboard for exploring public online conversations. It
turns posts and comments into traceable signals about sentiment, emotion,
topics, volume, and change over time. Instead of presenting one unexplained
score, it lets you move from a chart to the records behind it.

The project is designed for two audiences:

- **Researchers, students, and non-technical users** can start the app locally,
  upload a dataset or analyze a public Reddit/YouTube source, and explore the
  results in a browser.
- **Developers** can run the frontend and API independently, inspect the
  analysis pipeline, run tests, and reproduce the evaluation workflow.

> **Important:** VerdictLab is an exploratory research tool, not a fact checker,
> medical or legal adviser, or a replacement for human interpretation. Its
> emotion dimensions are SenticNet-derived indicators and are not validated
> emotion labels.

## What you can do

- Analyze public **Reddit** conversations from a Reddit URL.
- Analyze **YouTube comments** when a YouTube Data API key is configured.
- Upload **CSV, XLS, or XLSX** files containing text records.
- Compare SenticNet, VADER, and TextBlob sentiment signals.
- Explore:
  - a summary dashboard and report
  - sentiment and activity over time
  - the four exploratory Hourglass emotion dimensions
  - filtered, sortable source records in the Explorer
  - comparisons between conflicts, groups, or slices
  - live analysis of a short piece of text
  - validation metrics on a human-labelled dataset.
- Export filtered records and reports for further research.
- Share a dashboard locally using the QR-code sharing flow.
- Keep analyses associated with an account and delete them when no longer
  needed.

## Quick start: run it locally

### Prerequisites

For the simplest setup, install:

- macOS or Linux
- **Python 3.13** (the repository records this in
  [`backend/runtime.txt`](./backend/runtime.txt))
- **Node.js 20 or newer** and npm
- `curl` (used by the startup script to check API readiness).

Docker is also supported; see [Run with Docker Compose](#run-with-docker-compose).

### Start the application

From the repository root:

```bash
./start.sh
```

The script will:

1. create or reuse `backend/.venv`
2. install missing Python dependencies
3. check that SenticNet is available
4. start the FastAPI backend on `http://localhost:8000`
5. install frontend packages if needed
6. start the Next.js frontend on `http://localhost:3000`.

Open **[http://localhost:3000](http://localhost:3000)** in a browser.

To stop the application, press `Ctrl+C` in the terminal running `start.sh`.

### First use

1. Open the browser at `http://localhost:3000`.
2. Choose the demo/sample experience, or open the workspace.
3. Create an account or sign in.
4. In the workspace, choose one of:
   - a Reddit URL
   - a YouTube URL
   - an uploaded CSV/XLS/XLSX file.
5. Wait for ingestion and analysis to finish.
6. Use the timeline, emotions, compare, Explorer, and report views to inspect
   the results.

#### Verification codes in local development

If no SMTP server is configured, `start.sh` enables
`VERDICTLAB_DEV_CODES=true`. In this mode, sign-up and sign-in verification
codes are displayed by the application instead of being emailed. This is
convenient for a local demo, but it is **not safe for a public or production
deployment** because anyone who can access the application may be able to see
the codes.

## Run with Docker Compose

From the repository root:

```bash
docker compose up --build
```

Then open [http://localhost:3000](http://localhost:3000). The Compose setup:

- runs the API on port `8000`
- runs the frontend on port `3000`
- stores the SQLite database in a named Docker volume
- waits for the backend health check before starting the frontend
- enables development verification codes for review/demo use.

Stop the containers with:

```bash
docker compose down
```

To remove the named database volume as well (this deletes local Compose data):

```bash
docker compose down -v
```

## Using your own data

### Supported sources

The ingestion layer accepts:

- Reddit URLs
- YouTube video URLs
- `.csv`, `.xls`, and `.xlsx` files.

For spreadsheets, VerdictLab attempts to detect the text column and identify
whether rows represent posts or comments. For the most reliable results, use a
clear text column and include useful metadata such as date/time, source, and
group or subreddit.

Example CSV:

```csv
text,created_at,subreddit
"The report explains the method clearly.",2024-01-03T09:30:00Z,example
"I am not convinced by the evidence.",2024-01-03T10:15:00Z,example
```

The original text is retained as part of the evidence trail for an analysis.
Do not upload private, confidential, or personally identifying information
unless you have permission and understand how it is stored.

### YouTube

YouTube ingestion requires a YouTube Data API v3 key. Set
`YOUTUBE_API_KEY` in the backend environment before starting the API. Without
the key, local file and Reddit workflows can still be used.

### What the scores mean

VerdictLab intentionally shows multiple signals:

- **SenticNet** provides the main concept-level signal when coverage is
  sufficient.
- **VADER** is a baseline designed for short or informal text and is used as a
  fallback when SenticNet coverage is low.
- **TextBlob** provides a second baseline for comparison.

The production score should therefore be described as a
**SenticNet-or-VADER hybrid signal**, not as a pure SenticNet measurement.
Disagreement between methods is useful evidence to investigate, it is not proof
that one method is correct.

## Understanding the workspace

The main workspace views answer different questions:

| View | What it helps you investigate |
| --- | --- |
| Summary / report | What happened overall, and which records support the summary? |
| Timeline | When did activity or polarity change? |
| Emotions | Which exploratory Hourglass dimensions appear in the conversation, and how do they change? |
| Compare | How do two selected conflicts, groups, or slices differ? |
| Explorer | Which individual records produced the aggregate results? |
| Live | How do the three sentiment signals respond to one text? |
| Validation | How do the sentiment methods perform on a labelled evaluation file? |

Use the Explorer and source records to check important claims. Aggregates can
hide missing data, sarcasm, quotations, coordinated activity, or changes in
the composition of the conversation.

## Configuration

### Backend environment variables

The API reads these environment variables:

| Variable | Purpose | Local default |
| --- | --- | --- |
| `DATABASE_URL` | SQLAlchemy database connection string | SQLite database in the backend directory |
| `FRONTEND_URLS` | Comma-separated frontend origins allowed by CORS | `http://localhost:3000,http://127.0.0.1:3000` |
| `YOUTUBE_API_KEY` | Enables YouTube comment ingestion | Not set |
| `VERDICTLAB_DEV_CODES` | Shows verification codes when email delivery is unavailable | Enabled by `start.sh` when SMTP is absent |
| `VERDICTLAB_SKIP_DEMO_SEED` | Prevents the demo analysis from being created at startup | Not set |
| `SMTP_HOST` | SMTP server used to deliver verification and login codes | Not set |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | SMTP credentials | Not set |
| `SMTP_FROM` | Sender address | SMTP username or `noreply@example.com` |
| `SMTP_USE_TLS` | Enables SMTP TLS unless set to `false` | `true` |

For production-like use, configure SMTP and ensure `VERDICTLAB_DEV_CODES` is
not enabled. Use a persistent database, restrict `FRONTEND_URLS`, protect
credentials with your deployment secret manager, and serve the application
over HTTPS.

### Frontend environment variables

| Variable | Purpose | Local default |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE` | API URL used by the browser | `http://localhost:8000` |
| `NEXT_PUBLIC_SHARE_HOST` | Host placed into locally generated share links/QR codes | Detected LAN address when using `start.sh` |
| `NEXT_PUBLIC_SHARE_ORIGIN` | Explicit share origin; takes precedence over automatic detection | Not set |

When using Docker Compose, the frontend API address is supplied as a build
argument in [`docker-compose.yml`](./docker-compose.yml).

## Developer setup

### Start the backend by itself

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API health endpoint is available at
[http://localhost:8000/health](http://localhost:8000/health). FastAPI's
interactive API documentation is available at
[http://localhost:8000/docs](http://localhost:8000/docs).

### Start the frontend by itself

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend expects the API at `http://localhost:8000` unless
`NEXT_PUBLIC_API_BASE` is set.

### Run tests and builds

Backend tests:

```bash
cd backend
source .venv/bin/activate
pytest
```

Frontend production build:

```bash
cd frontend
npm run build
```

The frontend also defines `npm run lint`; use it when changing frontend code.

## Evaluation and research claims

The validation endpoint accepts a CSV, XLS, or XLSX file containing a text
column and a human label column. It requires at least 100 valid rows and
reports accuracy, macro-F1, per-class precision/recall/F1, a confusion matrix,
skipped rows, and deterministic bootstrap 95% confidence intervals.

For a reproducible benchmark:

```bash
cd backend
python scripts/run_benchmark.py
```

Read [`backend/EVALUATION.md`](./backend/EVALUATION.md) before reporting
results. In particular:

- use a held-out, human-labelled test set;
- record the dataset version, sampling procedure, label mapping, and
  annotator agreement;
- do not present a smoke-test subset as a benchmark;
- do not use production labels, SenticNet-derived labels, or hand-written
  examples as ground truth;
- do not describe the four Hourglass dimensions as validated emotion labels
  without a separate human-labelled emotion evaluation.

## Project structure

```text
.
├── backend/
│   ├── app/
│   │   ├── routers/       # Authentication, analyses, live analysis, evaluation
│   │   └── services/      # Ingestion, scoring, privacy, reports, retention
│   ├── scripts/           # Reproducible benchmark helpers
│   ├── tests/             # Backend tests
│   └── requirements.txt
├── frontend/
│   ├── app/               # Next.js routes and workspace screens
│   ├── components/        # Reusable UI components
│   └── lib/               # Browser/API client helpers
├── docker-compose.yml
└── start.sh               # Local development launcher
```

## Troubleshooting

**The page loads, but analysis requests fail**

Check that the backend is running and visit
[http://localhost:8000/health](http://localhost:8000/health). If the frontend
was started separately, confirm that `NEXT_PUBLIC_API_BASE` points to the
backend address visible from the browser.

**The startup script says that SenticNet is unavailable**

Activate the backend virtual environment and reinstall the requirements:

```bash
cd backend
source .venv/bin/activate
pip install -r requirements.txt
```

**YouTube analysis cannot start**

Set a valid `YOUTUBE_API_KEY` in the backend environment and restart the API.

**Other devices cannot open a shared dashboard**

Make sure the computer running the frontend and the mobile device are on the
same network, allow inbound connections to port `3000`, and set
`NEXT_PUBLIC_SHARE_HOST` to the computer's LAN address if automatic detection
does not work.

## Privacy and responsible use

Treat uploaded text and source URLs as research data. Obtain appropriate
permission, minimise personal data, and remove analyses when they are no
longer needed. Do not use sentiment or emotion indicators to make high-impact
decisions about people or communities. Read the in-app methodology and ethics
pages before interpreting results.
