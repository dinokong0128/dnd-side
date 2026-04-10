"""OpenAI embedding helper."""

from config import openai_client


def embed_text(text: str, dimensions: int = 1536) -> list[float]:
    """Generate an embedding vector for the given text using OpenAI."""
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
        dimensions=dimensions,
    )
    return response.data[0].embedding
