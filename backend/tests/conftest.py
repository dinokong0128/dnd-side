"""Shared pytest fixtures for backend tests."""

import os
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

# Set dummy environment variables before any config import
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-anthropic-key")
os.environ.setdefault("OPENAI_API_KEY", "test-openai-key")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test")


@pytest.fixture
def mock_supabase():
    """Mock the Supabase service-role client."""
    with patch("config.supabase_client") as mock:
        yield mock


@pytest.fixture
def mock_openai():
    """Mock the OpenAI client."""
    with patch("config.openai_client") as mock:
        yield mock


@pytest.fixture
def mock_anthropic():
    """Mock the Anthropic client."""
    with patch("config.anthropic_client") as mock:
        yield mock


@pytest.fixture
def mock_auth_user():
    """Override get_current_user dependency to return a fixed user ID."""
    return "test-user-uuid-1234"


@pytest.fixture
def client(mock_supabase, mock_auth_user):
    """FastAPI TestClient with mocked dependencies."""
    from main import app
    from api.dependencies import get_current_user

    app.dependency_overrides[get_current_user] = lambda: mock_auth_user
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def unauthed_client(mock_supabase):
    """FastAPI TestClient without auth override (will require real token)."""
    from main import app

    app.dependency_overrides.clear()
    yield TestClient(app)
    app.dependency_overrides.clear()


SAMPLE_GAME = {
    "id": "game-uuid-1",
    "name": "Dragon's Lair",
    "dm_persona": "A dark and mysterious DM.",
    "status": "active",
    "created_at": "2026-03-22T10:00:00Z",
    "updated_at": "2026-03-22T10:00:00Z",
    "created_by": "test-user-uuid-1234",
}

SAMPLE_PLAYER = {
    "id": "player-uuid-1",
    "game_id": "game-uuid-1",
    "profile_id": "test-user-uuid-1234",
    "character_name": "Thorin",
    "character_class": "warrior",
    "hp_current": 50,
    "hp_max": 50,
    "stats": {"strength": 18, "dexterity": 12},
    "status": "alive",
}
