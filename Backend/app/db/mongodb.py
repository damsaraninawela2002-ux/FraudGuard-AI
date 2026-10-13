import logging
from typing import Optional
import urllib.parse
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import get_settings

logger = logging.getLogger("fraudguard.mongodb")


class MongoDBManager:
    client: Optional[AsyncIOMotorClient] = None
    database: Optional[AsyncIOMotorDatabase] = None


mongodb_manager = MongoDBManager()


async def connect_to_mongo() -> None:
    """Initialize MongoDB client and create required indexes on startup."""
    settings = get_settings()
    parsed_uri = urllib.parse.urlsplit(settings.MONGODB_URI)
    host_part = parsed_uri.netloc.split("@")[-1] if parsed_uri.netloc else parsed_uri.path
    logger.info("Connecting to MongoDB at %s (db: %s)", host_part, settings.DB_NAME)

    mongodb_manager.client = AsyncIOMotorClient(
        settings.MONGODB_URI,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=5000,
    )
    mongodb_manager.database = mongodb_manager.client[settings.DB_NAME]

    # Create collection indexes during startup (non-blocking if MongoDB is down)
    try:
        users_collection = mongodb_manager.database["users"]
        await users_collection.create_index("email", unique=True)
        logger.info("Unique index created on users.email")

        transactions_collection = mongodb_manager.database["transactions"]
        await transactions_collection.create_index("transaction_id", unique=True, sparse=True)
        await transactions_collection.create_index("created_at")
        await transactions_collection.create_index("risk_level")
        await transactions_collection.create_index("prediction")
        await transactions_collection.create_index("createdAt")
        await transactions_collection.create_index("riskLevel")
        logger.info("Indexes created on transactions collection (transaction_id, created_at, risk_level, prediction)")
    except Exception as exc:
        logger.warning("Failed to create indexes on startup (MongoDB may be offline): %s", exc)


async def close_mongo_connection() -> None:
    """Close MongoDB connection gracefully."""
    if mongodb_manager.client is not None:
        logger.info("Closing MongoDB connection...")
        mongodb_manager.client.close()
        mongodb_manager.client = None
        mongodb_manager.database = None
        logger.info("MongoDB connection closed.")


def get_database() -> AsyncIOMotorDatabase:
    """Return active MongoDB database instance."""
    if mongodb_manager.database is None:
        raise RuntimeError("MongoDB connection is not initialized. Ensure connect_to_mongo() has been run.")
    return mongodb_manager.database
