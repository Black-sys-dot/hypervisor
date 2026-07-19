from fastapi import APIRouter
from typing import List
import os
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/isos", response_model=List[str])
def list_isos():
    prod_dir = "/var/lib/libvirt/boot/"
    local_dir = "/home/black/Projects/hypervisor/storage/boot/"
    
    # Check production directory first, then fallback to local project directory
    target_dir = prod_dir if os.path.exists(prod_dir) and os.path.isdir(prod_dir) else local_dir
    
    try:
        if os.path.exists(target_dir) and os.path.isdir(target_dir):
            files = os.listdir(target_dir)
            isos = [f for f in files if f.endswith(".iso") or f.endswith(".img")]
            if not isos:
                return ["ubuntu-24.04-server.iso", "alpine-minimal.iso"]
            return isos
        else:
            logger.info(f"Neither {prod_dir} nor {local_dir} found. Returning mock ISO array.")
            return ["ubuntu-24.04-server.iso", "alpine-minimal.iso"]
    except Exception as e:
        logger.error(f"Error scanning ISO directory: {e}")
        return ["ubuntu-24.04-server.iso", "alpine-minimal.iso"]
