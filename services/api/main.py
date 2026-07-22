"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import get_settings
from core.database import init_db, close_db
from api.v1.health import router as health_router

settings = get_settings()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    try:
        await init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.warning(f"Database initialization failed: {e}. Some features may be unavailable.")
    yield
    # Shutdown
    try:
        await close_db()
    except Exception:
        pass


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs" if settings.APP_ENV != "production" else None,
    redoc_url="/redoc" if settings.APP_ENV != "production" else None,
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:1420", "tauri://localhost"],  # Tauri dev and prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health_router, prefix="/api/v1")


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "docs": "/docs",
        "health": "/api/v1/health",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.APP_ENV == "development",
    )
