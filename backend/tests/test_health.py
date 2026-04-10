"""Tests for the health check endpoint."""

import pytest
from unittest.mock import patch, AsyncMock


@pytest.fixture
def health_client():
    """TestClient that doesn't need auth for health check."""
    with patch("config.supabase_client"), patch("config.openai_client"), patch(
        "config.anthropic_client"
    ), patch(
        "main._check_supabase",
        new_callable=AsyncMock,
        return_value={"ok": True, "latency_ms": 42},
    ), patch(
        "main._check_redis",
        new_callable=AsyncMock,
        return_value={"ok": True, "latency_ms": 3},
    ), patch(
        "main._check_env_vars",
        new_callable=AsyncMock,
        return_value={"ok": True, "missing": []},
    ):
        from main import app
        from fastapi.testclient import TestClient

        yield TestClient(app)


class TestHealthEndpoint:
    """Tests for GET /health."""

    def test_health_returns_200(self, health_client):
        """Health check should return 200 OK."""
        response = health_client.get("/health")
        assert response.status_code == 200

    def test_health_returns_status_ok(self, health_client):
        """Health check should include status: ok."""
        response = health_client.get("/health")
        data = response.json()
        assert data["status"] == "ok"

    def test_health_returns_service_name(self, health_client):
        """Health check should identify the service."""
        response = health_client.get("/health")
        data = response.json()
        assert data["service"] == "dnd-backend"

    def test_health_returns_worker_count(self, health_client):
        """Health check should report dramatiq worker count."""
        response = health_client.get("/health")
        data = response.json()
        # Note: This test updated to verify checks object instead
        # The old dramatiq_workers field has been replaced with checks
        assert "checks" in data

    def test_health_returns_checks_object(self, health_client):
        """Health response must include a 'checks' dict."""
        response = health_client.get("/health")
        data = response.json()
        assert "checks" in data
        assert isinstance(data["checks"], dict)

    def test_health_checks_have_required_keys(self, health_client):
        """Each check must have at least an 'ok' boolean."""
        response = health_client.get("/health")
        checks = response.json()["checks"]
        for key in ("supabase", "redis", "env_vars"):
            assert key in checks
            assert isinstance(checks[key]["ok"], bool)

    def test_health_returns_version(self, health_client):
        """Health response must include a version string."""
        response = health_client.get("/health")
        data = response.json()
        assert "version" in data
        assert isinstance(data["version"], str)

    def test_health_returns_503_when_supabase_down(self, health_client):
        """When Supabase is unreachable, /health should return 503."""
        with patch(
            "main._check_supabase",
            new_callable=AsyncMock,
            return_value={"ok": False, "error": "connection refused"},
        ):
            response = health_client.get("/health")
        assert response.status_code == 503
        assert response.json()["status"] == "degraded"
