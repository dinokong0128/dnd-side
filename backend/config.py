# backend/config.py
"""
Configuration and settings for D&D backend
"""
from pydantic_settings import BaseSettings
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
    DATABASE_URL: str  # Supabase Postgres connection string
    
    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",  # Local dev
        "https://*.vercel.app",   # Production Vercel
    ]
    
    # API
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"
        case_sensitive = True

# Load settings
settings = Settings()

# Clients (initialized at module level for efficiency)
from supabase import create_client

supabase_client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_ROLE_KEY,
)

# Anthropic client
from anthropic import Anthropic

anthropic_client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)

# OpenAI client
from openai import OpenAI

openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
