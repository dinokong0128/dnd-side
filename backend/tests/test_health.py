"""Tests for the health check endpoint."""
import pytest
from unittest.mock import patch


@pytest.fixture
def health_client():
    """TestClient that doesn't need auth for health check."""
    with patch("config.supabase_client"), \
         patch("config.openai_client"), \
         patch("config.anthropic_client"):
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
        assert "dramatiq_workers" in data
        assert isinstance(data["dramatiq_workers"], int)
