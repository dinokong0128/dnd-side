"""Tests for authentication dependencies."""
import pytest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException


class TestGetCurrentUser:
    """Tests for the get_current_user dependency."""

    @pytest.mark.asyncio
    async def test_valid_token_returns_user_id(self):
        """Valid JWT should return the user's UUID."""
        mock_user = MagicMock()
        mock_user.id = "user-uuid-123"
        mock_response = MagicMock()
        mock_response.user = mock_user

        with patch("api.dependencies.supabase_client") as mock_sb:
            mock_sb.auth.get_user.return_value = mock_response
            from api.dependencies import get_current_user
            result = await get_current_user(token="valid-jwt-token")
            assert result == "user-uuid-123"
            mock_sb.auth.get_user.assert_called_once_with("valid-jwt-token")

    @pytest.mark.asyncio
    async def test_invalid_token_raises_401(self):
        """Invalid JWT should raise 401 Unauthorized."""
        mock_response = MagicMock()
        mock_response.user = None

        with patch("api.dependencies.supabase_client") as mock_sb:
            mock_sb.auth.get_user.return_value = mock_response
            from api.dependencies import get_current_user
            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(token="invalid-token")
            assert exc_info.value.status_code == 401
            assert "Invalid or expired token" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_none_response_raises_401(self):
        """None response from Supabase auth should raise 401."""
        with patch("api.dependencies.supabase_client") as mock_sb:
            mock_sb.auth.get_user.return_value = None
            from api.dependencies import get_current_user
            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(token="some-token")
            assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_401_includes_www_authenticate_header(self):
        """401 response should include WWW-Authenticate header."""
        mock_response = MagicMock()
        mock_response.user = None

        with patch("api.dependencies.supabase_client") as mock_sb:
            mock_sb.auth.get_user.return_value = mock_response
            from api.dependencies import get_current_user
            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(token="bad-token")
            assert exc_info.value.headers == {"WWW-Authenticate": "Bearer"}
