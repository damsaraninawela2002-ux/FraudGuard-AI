from contextlib import asynccontextmanager
import logging
from typing import Any, AsyncGenerator, Dict
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymongo.errors import PyMongoError

from app.api.routes_auth import router as auth_router
from app.api.routes_model import router as model_router
from app.api.routes_predict import router as predict_router
from app.api.routes_transactions import router as transactions_router

from app.core.config import get_settings
from app.db.mongodb import close_mongo_connection, connect_to_mongo, get_database
from app.services.explain_service import get_explain_service
from app.services.ml_service import get_ml_service


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fraudguard.app")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Application startup: connecting to database...")
    await connect_to_mongo()

    logger.info("Application startup: initializing MLService...")
    ml_service = get_ml_service()
    ml_service.load_artifacts()

    logger.info("Application startup: initializing ExplainService...")
    explain_service = get_explain_service()
    explain_service.load_artifacts()

    yield

    logger.info("Application shutdown: closing database connection...")
    await close_mongo_connection()


settings = get_settings()

app = FastAPI(
    title="FraudGuard AI",
    description="Explainable Fraud Detection System",
    lifespan=lifespan,
)

# CORS middleware using configured origins (guaranteeing Vite dev origins are permitted)
allowed_origins = list(
    dict.fromkeys(
        settings.cors_origins_list
        + ["http://localhost:5173", "http://127.0.0.1:5173"]
    )
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Ensure no unhandled internal exceptions or stack traces are leaked to clients, and preserve CORS headers."""
    origin = request.headers.get("origin")
    cors_headers: Dict[str, str] = {}
    if origin and origin in allowed_origins:
        cors_headers = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Vary": "Origin",
        }

    if isinstance(exc, HTTPException):
        merged_headers = {**cors_headers, **(exc.headers or {})}
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=merged_headers,
        )

    if isinstance(exc, PyMongoError):
        logger.error("Database connection error: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"detail": "The database is currently unavailable. Please try again later."},
            headers=cors_headers,
        )

    logger.error("Unhandled server exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred."},
        headers=cors_headers,
    )


@app.get("/health")
def health_check() -> Dict[str, Any]:
    ml_service = get_ml_service()
    explain_service = get_explain_service()
    return {"status": "ok", "is_demo": ml_service.is_demo or explain_service.is_demo}


@app.get("/health/db")
async def health_db_check() -> Dict[str, Any]:
    try:
        db = get_database()
        await db.command("ping")
        return {"status": "ok", "database": "connected"}
    except Exception as exc:
        logger.error("Database health check ping failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unreachable: connection failure",
        )


# Register API routers
app.include_router(auth_router)
app.include_router(predict_router)
app.include_router(transactions_router)
app.include_router(model_router)


