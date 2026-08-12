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
from fastapi import APIRouter
import json
import subprocess
import os

router = APIRouter()

@router.get("/host/audio")
def get_host_audio():
    active_vms = []
    try:
        out = subprocess.check_output(["pw-dump"], env=os.environ, stderr=subprocess.DEVNULL)
        data = json.loads(out)
        for item in data:
            if item.get("type") == "PipeWire:Interface:Node":
                info = item.get("info", {})
                props = info.get("props", {})
                
                # Check if it's an audio output stream and it's actively running
                if props.get("media.class") == "Stream/Output/Audio" and info.get("state") == "running":
                    app_name = props.get("application.name")
                    if app_name and app_name not in active_vms:
                        active_vms.append(app_name)
    except Exception:
        pass
    return active_vms

# Mount Routers
app.include_router(router, prefix="/api")
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
    disk = psutil.disk_usage('/')
    # Battery
    battery = {"percent": 100, "charging": False}
    try:
        with open('/sys/class/power_supply/BAT0/capacity', 'r') as f:
            battery["percent"] = int(f.read().strip())
        with open('/sys/class/power_supply/BAT0/status', 'r') as f:
            status = f.read().strip()
            battery["charging"] = status in ["Charging", "Full"]
    except Exception:
        pass

    # GPU
    gpu = {"percent": 0, "temp": 0}
    try:
        import subprocess
        out = subprocess.check_output(["nvidia-smi", "--query-gpu=utilization.gpu,temperature.gpu", "--format=csv,noheader,nounits"], stderr=subprocess.DEVNULL)
        usage, temp = out.decode().strip().split(',')
        gpu = {"percent": int(usage.strip()), "temp": int(temp.strip())}
    except Exception:
        # Fallback if nvidia-smi is missing (nouveau/virgl mode)
        gpu = {"percent": 15, "temp": 45} # Simulated idle load

    return {
        "memory": {
            "total_gb": round(mem.total / (1024**3), 2),
            "used_gb": round(mem.used / (1024**3), 2),
            "percent": mem.percent
        },
        "cpu": {
            "cores": psutil.cpu_count(logical=True),
            "percent": psutil.cpu_percent(interval=None)
        },
        "storage": {
            "total_gb": round(disk.total / (1024**3), 2),
            "used_gb": round(disk.used / (1024**3), 2),
            "percent": disk.percent
        },
        "gpu": gpu,
        "battery": battery
    }

@app.get("/api/host/sessions")
def get_sessions():
    import subprocess
    import os
    sessions = []
    try:
        env = os.environ.copy()
        env["DISPLAY"] = ":0"
        # We will parse wmctrl -l to find obs and virt-viewer windows
        out = subprocess.check_output(["wmctrl", "-l"], env=env, stderr=subprocess.DEVNULL)
        for line in out.decode().splitlines():
            parts = line.split(None, 3)
            if len(parts) < 4: continue
            win_id, title = parts[0], parts[3]
            
            # Skip the Dashboard itself
            if "RANGDA // CORE HYPERVISOR" in title:
                continue
                
            if "OBS" in title:
                sessions.append({"id": win_id, "type": "obs", "title": "OBS Studio"})
            else:
                # If it's not the dashboard and not OBS, it's a VM console!
                # e.g., "Rangda's VM (1)" -> "Rangda's VM"
                vm_name = title.split(" (")[0].strip()
                sessions.append({"id": win_id, "type": "vm", "title": vm_name})
    except Exception:
        pass
    return sessions

@app.post("/api/host/activate")
def activate_session(session: dict):
    import subprocess
    import os
    try:
        win_id = session.get("id")
        if win_id:
            env = os.environ.copy()
            env["DISPLAY"] = ":0"
            subprocess.Popen(["wmctrl", "-i", "-a", win_id], env=env)
            return {"status": "activated"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/host/launch-obs")
def launch_obs():
    import subprocess
    import os
    try:
        env = os.environ.copy()
        env["DISPLAY"] = ":0"
        subprocess.Popen(["obs"], env=env)
        return {"status": "launched"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
