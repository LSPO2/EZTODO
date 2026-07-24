"""FastAPI application entry point."""

import logging
import time
from collections import defaultdict
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from core.config import get_settings
from core.database import init_db, close_db
from api.v1.health import router as health_router
from api.v1.auth import router as auth_router
from api.v1.sync import router as sync_router
from api.v1.ai import router as ai_router

settings = get_settings()
logger = logging.getLogger(__name__)
audit_logger = logging.getLogger("audit")


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple in-memory rate limiter for login endpoint."""

    def __init__(self, app, max_requests: int = 10, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        # Only rate-limit login endpoint
        if request.url.path == "/api/v1/auth/login" and request.method == "POST":
            client_ip = request.client.host if request.client else "unknown"
            now = time.time()
            # Clean old entries
            self.requests[client_ip] = [
                t for t in self.requests[client_ip] if now - t < self.window_seconds
            ]
            if len(self.requests[client_ip]) >= self.max_requests:
                audit_logger.warning(f"Rate limit exceeded for {client_ip} on login")
                return Response(
                    content='{"detail":"Too many login attempts. Please try again later."}',
                    status_code=429,
                    media_type="application/json",
                )
            self.requests[client_ip].append(now)

        response = await call_next(request)
        return response


class RequestBodyLimitMiddleware(BaseHTTPMiddleware):
    """Limit request body size."""

    def __init__(self, app, max_size: int = 10 * 1024 * 1024):  # 10MB default
        super().__init__(app)
        self.max_size = max_size

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > self.max_size:
            return Response(
                content='{"detail":"Request body too large"}',
                status_code=413,
                media_type="application/json",
            )
        return await call_next(request)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    try:
        await init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.warning(f"Database initialization failed: {e}. Some features may be unavailable.")

    # Validate production secrets
    if settings.APP_ENV == "production":
        if settings.JWT_SECRET_KEY in ("your_jwt_secret_change_in_production", "dev_secret_key_change_in_production", ""):
            logger.error("JWT_SECRET_KEY is not set to a secure value in production!")
            raise RuntimeError("JWT_SECRET_KEY must be changed in production")

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

# Security middleware
app.add_middleware(RateLimitMiddleware, max_requests=10, window_seconds=60)
app.add_middleware(RequestBodyLimitMiddleware, max_size=10 * 1024 * 1024)

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
app.include_router(auth_router, prefix="/api/v1")
app.include_router(sync_router, prefix="/api/v1")
app.include_router(ai_router, prefix="/api/v1")


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
