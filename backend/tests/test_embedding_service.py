"""Tests for the embedding service."""
import pytest
from unittest.mock import MagicMock, patch


class TestEmbedText:
    """Tests for embed_text()."""

    @patch("services.embedding_service.openai_client")
    def test_returns_embedding_vector(self, mock_openai):
        """Should return a list of floats from OpenAI."""
        expected_embedding = [0.1, 0.2, 0.3] * 512  # 1536 dims
        mock_response = MagicMock()
        mock_response.data = [MagicMock(embedding=expected_embedding)]
        mock_openai.embeddings.create.return_value = mock_response

        from services.embedding_service import embed_text
        result = embed_text("Hello world")

        assert result == expected_embedding
        assert len(result) == 1536

    @patch("services.embedding_service.openai_client")
    def test_calls_correct_model(self, mock_openai):
        """Should use text-embedding-3-small model."""
        mock_response = MagicMock()
        mock_response.data = [MagicMock(embedding=[0.1] * 1536)]
        mock_openai.embeddings.create.return_value = mock_response

        from services.embedding_service import embed_text
        embed_text("test input")

        mock_openai.embeddings.create.assert_called_once_with(
            model="text-embedding-3-small",
            input="test input",
            dimensions=1536,
        )

    @patch("services.embedding_service.openai_client")
    def test_custom_dimensions(self, mock_openai):
        """Should pass custom dimensions to OpenAI."""
        mock_response = MagicMock()
        mock_response.data = [MagicMock(embedding=[0.1] * 768)]
        mock_openai.embeddings.create.return_value = mock_response

        from services.embedding_service import embed_text
        result = embed_text("test", dimensions=768)

        mock_openai.embeddings.create.assert_called_once_with(
            model="text-embedding-3-small",
            input="test",
            dimensions=768,
        )
        assert len(result) == 768

    @patch("services.embedding_service.openai_client")
    def test_default_dimensions_is_1536(self, mock_openai):
        """Should default to 1536 dimensions."""
        mock_response = MagicMock()
        mock_response.data = [MagicMock(embedding=[0.1] * 1536)]
        mock_openai.embeddings.create.return_value = mock_response

        from services.embedding_service import embed_text
        embed_text("test")

        call_kwargs = mock_openai.embeddings.create.call_args[1]
        assert call_kwargs["dimensions"] == 1536
