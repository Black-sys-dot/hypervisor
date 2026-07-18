from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List
import logging
from app.core.libvirt import get_libvirt_manager, LibvirtManager

try:
    import libvirt
    HAS_LIBVIRT = True
except ImportError:
    HAS_LIBVIRT = False

router = APIRouter()
logger = logging.getLogger(__name__)

class VMResponse(BaseModel):
    id: int
    name: str
    uuid: str
    status: str
    vcpus: int
    memory_kb: int

class VMAction(BaseModel):
    action: str # start, shutdown, destroy, reboot

def map_state(state_int: int) -> str:
    # State mapping based on libvirt constants or fallback
    if HAS_LIBVIRT:
        mapping = {
            libvirt.VIR_DOMAIN_NOSTATE: "no state",
            libvirt.VIR_DOMAIN_RUNNING: "running",
            libvirt.VIR_DOMAIN_BLOCKED: "blocked",
            libvirt.VIR_DOMAIN_PAUSED: "paused",
            libvirt.VIR_DOMAIN_SHUTDOWN: "being shut down",
            libvirt.VIR_DOMAIN_SHUTOFF: "shut off",
            libvirt.VIR_DOMAIN_CRASHED: "crashed",
            libvirt.VIR_DOMAIN_PMSUSPENDED: "suspended by guest power management",
        }
    else:
        mapping = {
            0: "no state",
            1: "running",
            2: "blocked",
            3: "paused",
            4: "being shut down",
            5: "shut off",
            6: "crashed",
            7: "suspended by guest power management",
        }
    return mapping.get(state_int, "unknown")

@router.get("", response_model=List[VMResponse])
def get_vms(manager: LibvirtManager = Depends(get_libvirt_manager)):
    conn = manager.get_connection()
    vms = []
    try:
        domains = conn.listAllDomains(0)
        for dom in domains:
            state, reason = dom.state()
            
            # vcpus can be tricky if domain is shut off
            vcpus = 0
            try:
                vcpus = dom.vcpusFlags()
            except Exception:
                pass
            
            vms.append(VMResponse(
                id=dom.ID(),
                name=dom.name(),
                uuid=dom.UUIDString(),
                status=map_state(state),
                vcpus=vcpus,
                memory_kb=dom.maxMemory()
            ))
    except Exception as e:
        logger.error(f"Error fetching VMs: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch virtual machines")
    return vms

@router.post("/{uuid_str}/action")
def vm_action(uuid_str: str, action_data: VMAction, manager: LibvirtManager = Depends(get_libvirt_manager)):
    conn = manager.get_connection()
    try:
        dom = conn.lookupByUUIDString(uuid_str)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"VM with UUID {uuid_str} not found")
        
    action = action_data.action.lower()
    try:
        if action == "start":
            dom.create()
        elif action == "shutdown":
            dom.shutdown()
        elif action == "destroy":
            dom.destroy()
        elif action == "reboot":
            dom.reboot()
        else:
            raise HTTPException(status_code=400, detail=f"Invalid action: {action}. Supported: start, shutdown, destroy, reboot.")
    except Exception as e:
        logger.error(f"Failed to execute {action} on {uuid_str}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to execute action {action}")
        
    return {"status": "success", "action": action, "uuid": uuid_str}
