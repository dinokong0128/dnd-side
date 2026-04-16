# backend/config.py
"""
Configuration and settings for D&D backend
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import os


class Settings(BaseSettings):
    """Application settings from environment variables"""

    # Supabase
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str  # Use service role for backend mutations
    SUPABASE_ANON_KEY: str  # For verifying JWT tokens

    # External APIs
    ANTHROPIC_API_KEY: str
    OPENAI_API_KEY: str

    # Redis (Dramatiq broker)
    REDIS_URL: str = "redis://localhost:6379"

    # Database
    DATABASE_URL: str = ""  # Currently unused — all DB ops use supabase-py

    # Frontend
    FRONTEND_URL: str = "http://localhost:3000"

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",  # Local dev
        "https://*.vercel.app",  # Production Vercel
    ]

    # API
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    LOG_LEVEL: str = "INFO"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)


# Load settings
settings = Settings()

# Clients (initialized at module level for efficiency)
from supabase import create_client

supabase_client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_ROLE_KEY,
)

# Anthropic client
from anthropic import Anthropic, AsyncAnthropic

anthropic_client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)

# Async Anthropic — used only by the SSE streaming path in actions.py.
# Dramatiq tasks and all non-streaming narration paths keep using the sync
# anthropic_client above.
anthropic_async_client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

# OpenAI client with connection reuse (DIN-65)
import httpx
from openai import OpenAI

openai_client = OpenAI(
    api_key=settings.OPENAI_API_KEY,
    http_client=httpx.Client(
        limits=httpx.Limits(
            max_keepalive_connections=5,
            max_connections=10,
            keepalive_expiry=30,
        ),
        timeout=httpx.Timeout(30.0),
    ),
)

# Async Redis — used only by the SSE streaming path for pub/sub
# (publish from _stream_to_redis; subscribe from the /events endpoint).
# The sync redis_client in redis_broker.py (Dramatiq broker) is unchanged.
import redis.asyncio as aioredis

redis_async_client = aioredis.from_url(settings.REDIS_URL)
