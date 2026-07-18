from fastapi import APIRouter
from typing import List
import os
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/isos", response_model=List[str])
def list_isos():
    boot_dir = "/var/lib/libvirt/boot/"
    try:
        if os.path.exists(boot_dir) and os.path.isdir(boot_dir):
            files = os.listdir(boot_dir)
            isos = [f for f in files if f.endswith(".iso") or f.endswith(".img")]
            if not isos:
                return ["ubuntu-24.04-server.iso", "alpine-minimal.iso"]
            return isos
        else:
            logger.info(f"Directory {boot_dir} not found. Returning mock ISO array.")
            return ["ubuntu-24.04-server.iso", "alpine-minimal.iso"]
    except Exception as e:
        logger.error(f"Error scanning ISO directory: {e}")
        return ["ubuntu-24.04-server.iso", "alpine-minimal.iso"]
