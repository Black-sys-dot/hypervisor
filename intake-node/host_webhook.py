from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
import logging
import os
import shutil

router = APIRouter()
logger = logging.getLogger(__name__)

class IntakePayload(BaseModel):
    filename: str
    status: str
    asset_type: str

# Physical paths on the Host
HOST_INTAKE_VAULT = "/var/lib/rangda/intake/vault"
HOST_LIBVIRT_BOOT = "/var/lib/libvirt/boot"

def ingest_to_libvirt(filename: str):
    """Background task to securely ingest the verified file to hypervisor storage."""
    src = os.path.join(HOST_INTAKE_VAULT, filename)
    dst = os.path.join(HOST_LIBVIRT_BOOT, filename)
    
    try:
        # Move the verified image out of the intake share and into locked libvirt storage
        if os.path.exists(src):
            shutil.move(src, dst)
            logger.info(f"Successfully ingested {filename} to {dst}")
            # In a full setup, you would fire a WebSocket event here to update the React UI
    except Exception as e:
        logger.error(f"Failed to ingest {filename}: {e}")

@router.post("/webhook")
def intake_webhook(payload: IntakePayload, bg_tasks: BackgroundTasks):
    """
    Listens for secure signals from the Intake VM on the 192.168.122.1 gateway.
    """
    if payload.status == "verified_safe" and payload.asset_type == "boot_image":
        logger.info(f"[LOADING DOCK] Received intake signal for {payload.filename}")
        
        # Dispatch host-side ingest logic
        bg_tasks.add_task(ingest_to_libvirt, payload.filename)
        
        return {"message": "Intake authorized. Host is acquiring asset."}
    
    raise HTTPException(status_code=403, detail="Unrecognized status or asset type")
