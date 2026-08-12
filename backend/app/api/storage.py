from fastapi import APIRouter
from typing import List
import os
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/isos", response_model=List[str])
def list_isos():
    project_dir = os.getenv("RANGDA_BOOT_DIR", os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../storage/boot/")))
    prod_dir = "/var/lib/libvirt/boot/"
    
    # Priority: project ISO directory, then system prod directory
    dirs_to_check = [project_dir, prod_dir]
    isos = []
    
    for d in dirs_to_check:
        try:
            if os.path.exists(d) and os.path.isdir(d):
                files = os.listdir(d)
                found = [os.path.join(d, f) for f in files if f.endswith(".iso") or f.endswith(".img")]
                if found:
                    isos.extend(found)
                    break
        except Exception as e:
            logger.warning(f"Skipping ISO dir {d}: {e}")
            
    if not isos:
        return ["ubuntu-24.04-server.iso", "alpine-minimal.iso"]
    return isos
