# backend/redis_broker.py
"""
Dramatiq broker setup with Redis
"""
import dramatiq
from dramatiq.brokers.redis import RedisBroker
from redis import Redis
import os

# Redis connection
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
redis_client = Redis.from_url(REDIS_URL, decode_responses=True)

# Dramatiq broker with Redis
redis_broker = RedisBroker(url=REDIS_URL)
redis_broker.emit_after("process_boot", lambda _: print("Dramatiq broker ready"))

# Set as default broker
dramatiq.set_broker(redis_broker)

# Export for use in tasks
dramatiq_app = redis_broker
