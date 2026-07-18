from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import xml.etree.ElementTree as ET
import logging
import psutil
import re
import os
import uuid
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
    vnc_port: Optional[int] = None
    ws_port: Optional[int] = None
    ip_address: Optional[str] = None

class VMCreate(BaseModel):
    name: str
    vcpus: int
    memory_mb: int
    iso_path: str

class VMAction(BaseModel):
    action: str # start, shutdown, destroy, reboot

def map_state(state_int: int) -> str:
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
            vcpus = 0
            try:
                vcpus = dom.vcpusFlags()
            except Exception:
                pass
            
            vnc_port = None
            ws_port = None
            ip_address = None
            
            if state == libvirt.VIR_DOMAIN_RUNNING:
                try:
                    xml_desc = dom.XMLDesc(0)
                    root = ET.fromstring(xml_desc)
                    graphics = root.find("./devices/graphics[@type='vnc']")
                    if graphics is not None:
                        vport = graphics.get("port")
                        wport = graphics.get("websocket")
                        if vport and vport != "-1": vnc_port = int(vport)
                        if wport and wport != "-1": ws_port = int(wport)
                        
                    ifaces = dom.interfaceAddresses(libvirt.VIR_DOMAIN_INTERFACE_ADDRESSES_SRC_LEASE)
                    if ifaces:
                        for iface, data in ifaces.items():
                            if data.get('addrs'):
                                ip_address = data['addrs'][0]['addr']
                                break
                except Exception as e:
                    logger.warning(f"Extended info failed for {dom.name()}: {e}")
            
            vms.append(VMResponse(
                id=dom.ID(),
                name=dom.name(),
                uuid=dom.UUIDString(),
                status=map_state(state),
                vcpus=vcpus,
                memory_kb=dom.maxMemory(),
                vnc_port=vnc_port,
                ws_port=ws_port,
                ip_address=ip_address
            ))
            
        # Append safe dummy VMs created on EndeavourOS during live mode
        for dvm in manager.dummy_vms:
            is_run = dvm["status"] == "running"
            vms.append(VMResponse(
                id=dvm["id"],
                name=dvm["name"],
                uuid=dvm["uuid"],
                status=dvm["status"],
                vcpus=dvm["vcpus"],
                memory_kb=dvm["memory_kb"],
                vnc_port=5900 if is_run else None,
                ws_port=5700 if is_run else None,
                ip_address="192.168.122.100" if is_run else None
            ))
            
    except Exception as e:
        logger.error(f"Error fetching VMs: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch virtual machines")
    return vms

@router.post("/{uuid_str}/action")
def vm_action(uuid_str: str, action_data: VMAction, manager: LibvirtManager = Depends(get_libvirt_manager)):
    conn = manager.get_connection()
    
    # Check if this is a dummy VM
    for i, dvm in enumerate(manager.dummy_vms):
        if dvm["uuid"] == uuid_str:
            action = action_data.action.lower()
            if action == "start":
                manager.dummy_vms[i]["status"] = "running"
            elif action == "shutdown":
                manager.dummy_vms[i]["status"] = "shut off"
            elif action == "destroy":
                manager.dummy_vms[i]["status"] = "shut off"
            elif action == "reboot":
                manager.dummy_vms[i]["status"] = "running"
            return {"status": "success", "action": action, "uuid": uuid_str}
    
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

@router.post("")
def create_vm(vm_data: VMCreate, manager: LibvirtManager = Depends(get_libvirt_manager)):
    # 1. Hardware Capacity Validation & Safety Guardrails
    mem = psutil.virtual_memory()
    free_ram_mb = mem.available / (1024 * 1024)
    if free_ram_mb - vm_data.memory_mb < 2048:
        raise HTTPException(
            status_code=400, 
            detail="Hardware Safety Violation: Insufficient RAM reserved for Host Core. Keep at least 2GB free."
        )

    total_cores = psutil.cpu_count(logical=True)
    if total_cores - vm_data.vcpus < 2:
        raise HTTPException(
            status_code=400, 
            detail="Hardware Safety Violation: Insufficient CPU threads reserved for Host Core. Keep at least 2 threads free."
        )

    safe_name = re.sub(r'[^a-zA-Z0-9\-_]', '', vm_data.name)
    if not safe_name:
        raise HTTPException(status_code=400, detail="Invalid VM Name provided. Use standard alphanumeric characters.")

    # 2. Optimized Libvirt XML Engine
    xml_blueprint = f"""<domain type='kvm'>
  <name>{safe_name}</name>
  <memory unit='MiB'>{vm_data.memory_mb}</memory>
  <vcpu placement='static'>{vm_data.vcpus}</vcpu>
  <os>
    <type arch='x86_64' machine='q35'>hvm</type>
    <boot dev='cdrom'/>
    <boot dev='hd'/>
  </os>
  <cpu mode='host-passthrough' check='none'/>
  <devices>
    <disk type='file' device='disk'>
      <driver name='qemu' type='qcow2'/>
      <source file='/var/lib/libvirt/images/{safe_name}.qcow2'/>
      <target dev='vda' bus='virtio'/>
    </disk>
    <disk type='file' device='cdrom'>
      <driver name='qemu' type='raw'/>
      <source file='{vm_data.iso_path}'/>
      <target dev='sda' bus='sata'/>
      <readonly/>
    </disk>
    <interface type='network'>
      <source network='default'/>
      <model type='virtio'/>
    </interface>
    <graphics type='vnc' port='-1' autoport='yes' websocket='-1' listen='0.0.0.0'/>
    <video>
      <model type='qxl'/>
    </video>
    <input type='tablet' bus='usb'/>
    <input type='mouse' bus='ps2'/>
  </devices>
</domain>"""

    # Ensure EndeavourOS safety lock
    is_endeavour = False
    try:
        with open("/etc/os-release") as f:
            if "EndeavourOS" in f.read():
                is_endeavour = True
    except:
        pass

    conn = manager.get_connection()

    # 3. Execution & Mock Fallback Preservation
    if manager.is_mock or is_endeavour:
        logger.info(f"--- SAFE MOCK MODE ACTIVATED ---\nGenerated XML Blueprint:\n{xml_blueprint}")
        
        if manager.is_mock:
            conn.create_mock_domain(safe_name, vm_data.vcpus, vm_data.memory_mb * 1024)
        else:
            # We are connected to live libvirt but trapped by the EndeavourOS safety lock.
            # Append a dummy structural dictionary directly to the manager.
            manager.dummy_vms.append({
                "id": len(manager.dummy_vms) + 9000,
                "name": safe_name,
                "uuid": str(uuid.uuid4()),
                "status": "shut off",
                "vcpus": vm_data.vcpus,
                "memory_kb": vm_data.memory_mb * 1024
            })
            
        return {"status": "success", "message": "Simulated Safe-Mode Domain Generated", "name": safe_name}
    else:
        # Actual Hardware Execution
        try:
            dom = conn.defineXML(xml_blueprint)
            if not dom:
                raise Exception("Failed to define XML via Libvirt daemon.")
            
            # Note: We just define it here. User can click "Start" in UI to boot it.
            logger.info(f"Live VM {safe_name} successfully provisioned on hardware.")
            return {"status": "success", "message": "Live Domain Provisioned via XML", "name": safe_name}
            
        except Exception as e:
            logger.error(f"Failed to define VM via libvirt: {e}")
            raise HTTPException(status_code=500, detail=f"Hypervisor Definition Error: {str(e)}")
