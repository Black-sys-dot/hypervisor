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
    try:
        with open("/etc/os-release") as f:
            if "EndeavourOS" in f.read():
                logger.warning("Development Sandbox Net Active (EndeavourOS Detected).")
            else:
                logger.info("Live Target 'rangda' Active.")
    except Exception:
        pass
        
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

from app.api.storage import router as storage_router
from app.api.p2p import router as p2p_router

# Mount Routers
app.include_router(vms_router, prefix="/api/vms", tags=["Virtual Machines"])
app.include_router(storage_router, prefix="/api/storage", tags=["Storage"])
app.include_router(p2p_router)

from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
import os

@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/dashboard/")

frontend_path = os.path.join(os.path.dirname(__file__), "../../frontend")
app.mount("/dashboard", StaticFiles(directory=frontend_path, html=True), name="frontend")

import psutil

@app.get("/api/health", tags=["Health"])
def health_check():
    manager = get_libvirt_manager()
    return {
        "status": "ok",
        "libvirt_mock_mode": manager.is_mock
    }

@app.get("/api/host/metrics", tags=["Host"])
def host_metrics():
    mem = psutil.virtual_memory()
    return {
        "memory": {
            "total_gb": round(mem.total / (1024**3), 2),
            "used_gb": round(mem.used / (1024**3), 2),
            "percent": mem.percent
        },
        "cpu": {
            "cores": psutil.cpu_count(logical=True),
            "percent": psutil.cpu_percent(interval=None)
        }
    }
