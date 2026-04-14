#!/usr/bin/env python3
"""
backfill_embeddings.py

One-shot script to backfill NULL embeddings in the game_events table.
Run whenever OpenAI quota is restored after a gap:

    cd backend && python backfill_embeddings.py

Safe to re-run — only processes rows where embedding IS NULL.
"""

import logging
import sys
import time

from config import openai_client, supabase_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMS = 1536
BATCH_SIZE = 20  # rows per page (stay well under OpenAI RPM)
DELAY_BETWEEN_CALLS = 0.3  # seconds between OpenAI calls


def embed_text(text: str) -> list[float]:
    response = openai_client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=text,
        dimensions=EMBEDDING_DIMS,
    )
    return response.data[0].embedding


def backfill() -> None:
    logger.info("Starting embedding backfill...")

    # Fetch all rows with null embeddings
    result = (
        supabase_client.table("game_events")
        .select("id, summary")
        .is_("embedding", "null")
        .order("created_at")
        .execute()
    )

    rows = result.data or []
    if not rows:
        logger.info("No rows with null embeddings found. Nothing to do.")
        return

    logger.info(f"Found {len(rows)} row(s) to backfill.")
    success = 0
    failed = 0

    for i, row in enumerate(rows):
        event_id = row["id"]
        summary = row.get("summary", "")

        if not summary:
            logger.warning(f"[{i+1}/{len(rows)}] Skipping {event_id} — empty summary")
            continue

        try:
            logger.info(f"[{i+1}/{len(rows)}] Embedding {event_id[:8]}... '{summary[:60]}'")
            embedding = embed_text(summary)

            supabase_client.table("game_events").update(
                {"embedding": embedding}
            ).eq("id", event_id).execute()

            logger.info(f"[{i+1}/{len(rows)}] ✓ Updated {event_id[:8]}")
            success += 1

        except Exception as e:
            logger.error(f"[{i+1}/{len(rows)}] ✗ Failed {event_id[:8]}: {e}")
            failed += 1

        # Small delay to avoid OpenAI rate limits
        if i < len(rows) - 1:
            time.sleep(DELAY_BETWEEN_CALLS)

    logger.info(
        f"Backfill complete. {success} succeeded, {failed} failed "
        f"out of {len(rows)} total."
    )
    if failed:
        logger.warning("Some rows failed — re-run the script to retry.")
        sys.exit(1)


if __name__ == "__main__":
    backfill()
