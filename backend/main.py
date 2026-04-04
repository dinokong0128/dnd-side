# backend/main.py
"""
FastAPI app + Dramatiq worker setup for D&D Multiplayer backend
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from dramatiq import get_broker
from redis import Redis

from config import settings
from redis_broker import redis_broker, dramatiq_app
from api.middleware import add_middleware
from api.routes import games, players, actions

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

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "dnd-backend",
        "dramatiq_workers": 1,
    }

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
