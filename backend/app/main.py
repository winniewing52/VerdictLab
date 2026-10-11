import logging
import os
import threading
import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .database import Base, engine, run_startup_migrations
from .routers import analyses, auth, live, evaluations
from .services.demo_seed import start_demo_seed_thread
from .services.retention import purge_expired, start_retention_worker

logger = logging.getLogger("verdictlab")

Base.metadata.create_all(bind=engine)
run_startup_migrations()

@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Start-up: purge expired data, create the demo sample, keep sweeping in the background."""
    stop = threading.Event()
    try:
        purge_expired()
    except Exception:
        logger.exception("Initial retention sweep failed")
    start_retention_worker(stop)
    if os.getenv("VERDICTLAB_SKIP_DEMO_SEED", "").lower() not in ("1", "true", "yes"):
        start_demo_seed_thread()
    yield
    stop.set()

app = FastAPI(title="VerdictLab API", version="0.2.0", lifespan=lifespan)

@app.middleware("http")
async def catch_unexpected_errors(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as exc:
        logger.error("Unhandled error on %s %s\n%s", request.method, request.url.path, traceback.format_exc())
        print(f"[error] {request.method} {request.url.path}: {exc!r}")
        return JSONResponse(
            status_code=500,
            content={"detail": "The server hit an unexpected error. Please try again in a moment."},
        )

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "FRONTEND_URLS",
            "http://localhost:3000,http://127.0.0.1:3000",
        ).split(",")
        if origin.strip()
    ],

    allow_origin_regex=(
        r"https?://("
        r"localhost|127\.0\.0\.1|"
        r"192\.168\.\d{1,3}\.\d{1,3}|"
        r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
        r"172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}"
        r")(:\d+)?$"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyses.router)
app.include_router(auth.router)
app.include_router(live.router)
app.include_router(evaluations.router)

@app.get("/health")
def health():
    return {"status": "ok"}
