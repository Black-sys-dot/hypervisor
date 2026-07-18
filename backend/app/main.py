from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.api.vms import router as vms_router
from app.core.libvirt import get_libvirt_manager
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize the libvirt connection pool
    logger.info("Starting up Rangda API...")
    manager = get_libvirt_manager()
    manager.connect()
    yield
    # Shutdown: Cleanly close the connection
    logger.info("Shutting down Rangda API...")
    manager.disconnect()

app = FastAPI(
    title="Rangda Hypervisor Dashboard API",
    description="Backend API for Rangda Linux hypervisor dashboard managing libvirt",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration
# Dynamically allow common local development frontend origins, and * for flexibility
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "*" # Use specific domains in production
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(vms_router, prefix="/api/vms", tags=["Virtual Machines"])

from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
import os

@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/dashboard/")

frontend_path = os.path.join(os.path.dirname(__file__), "../../frontend")
app.mount("/dashboard", StaticFiles(directory=frontend_path, html=True), name="frontend")

@app.get("/health", tags=["Health"])
def health_check():
    manager = get_libvirt_manager()
    return {
        "status": "ok",
        "libvirt_mock_mode": manager.is_mock
    }
