# backend/main.py
"""
FastAPI app + Dramatiq worker setup for D&D Multiplayer backend
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import os
import time
import asyncio
from dramatiq import get_broker
from redis import Redis

from config import settings, supabase_client
from redis_broker import redis_broker, redis_client, dramatiq_app
from api.middleware import add_middleware
from api.routes import games, players, actions, invites

# Initialize FastAPI app
app = FastAPI(
    title="D&D Multiplayer API",
    description="Backend for multiplayer D&D game with Claude DM",
    version="0.1.0",
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom middleware (logging, auth, etc.)
add_middleware(app)

# Include routers
app.include_router(games.router, prefix="/games", tags=["games"])
app.include_router(players.router, prefix="/games", tags=["players"])
app.include_router(actions.router, prefix="/games", tags=["actions"])
app.include_router(invites.router, prefix="/games", tags=["invites"])

@app.get("/health")
async def health_check():
    """
    Health check endpoint with real dependency probes.

    Returns 200 with status "ok" when all dependencies are healthy.
    Returns 503 with status "degraded" when any dependency is unreachable.
    """
    checks = {
        "supabase": await _check_supabase(),
        "redis": await _check_redis(),
        "env_vars": await _check_env_vars(),
    }

    # Determine overall status
    all_ok = all(check.get("ok", False) for check in checks.values())
    status = "ok" if all_ok else "degraded"

    response_data = {
        "status": status,
        "service": "dnd-backend",
        "version": app.version,
        "checks": checks,
    }

    # Return 503 if degraded, 200 if ok
    if not all_ok:
        return JSONResponse(response_data, status_code=503)

    return response_data


async def _check_supabase() -> dict:
    """Check Supabase connectivity with latency measurement."""
    try:
        start = time.perf_counter()
        # Execute a minimal read query (just fetch 1 id, no filtering needed)
        await asyncio.to_thread(
            lambda: supabase_client.table("games").select("id").limit(1).execute()
        )
        latency_ms = (time.perf_counter() - start) * 1000
        return {"ok": True, "latency_ms": round(latency_ms, 2)}
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def _check_redis() -> dict:
    """Check Redis connectivity with latency measurement."""
    try:
        start = time.perf_counter()
        await asyncio.to_thread(redis_client.ping)
        latency_ms = (time.perf_counter() - start) * 1000
        return {"ok": True, "latency_ms": round(latency_ms, 2)}
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def _check_env_vars() -> dict:
    """Check required environment variables are set."""
    required_vars = [
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_ANON_KEY",
        "ANTHROPIC_API_KEY",
        "OPENAI_API_KEY",
        "REDIS_URL",
    ]

    missing = [var for var in required_vars if not os.environ.get(var)]

    if missing:
        return {"ok": False, "missing": missing}

    return {"ok": True, "missing": []}

@app.on_event("startup")
async def startup():
    """Initialize connections on startup"""
    logging.info("Backend starting up...")
    logging.info(f"Dramatiq broker: {get_broker()}")

@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown"""
    logging.info("Backend shutting down...")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
