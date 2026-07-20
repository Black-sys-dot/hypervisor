from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import uuid
import json
import asyncio
from app.core.libvirt import get_libvirt_manager, LibvirtManager

router = APIRouter(prefix="/api/p2p", tags=["p2p"])

class TransferRequest(BaseModel):
    source_uuid: str
    source_path: str
    dest_uuid: str
    dest_path: str

# Mock File Tree for Sandbox
MOCK_FILE_TREE = [
    {"name": "Documents", "type": "dir", "path": "/Documents"},
    {"name": "Downloads", "type": "dir", "path": "/Downloads"},
    {"name": "payload.bin", "type": "file", "path": "/payload.bin"},
    {"name": "config.json", "type": "file", "path": "/config.json"}
]

@router.get("/{uuid_str}/files")
def get_vm_files(uuid_str: str, path: str = "/", manager: LibvirtManager = Depends(get_libvirt_manager)):
    if uuid_str == "host":
        if path == "/":
            return [
                {"name": "quarantine", "type": "dir", "path": "/quarantine"},
                {"name": "isos", "type": "dir", "path": "/isos"}
            ]
        elif path == "/quarantine":
            return [{"name": "malware_sample.exe", "type": "file", "path": "/quarantine/malware_sample.exe"}]
        elif path == "/isos":
            return [{"name": "ubuntu-24.04-server.iso", "type": "file", "path": "/isos/ubuntu-24.04-server.iso"}]
        return []

    # 1. Look up VM
    vm_name = "Unknown"
    if manager.is_mock or uuid_str.startswith("0000") or any(d["uuid"] == uuid_str for d in manager.dummy_vms):
        vm_name = next((d["name"] for d in manager.dummy_vms if d["uuid"] == uuid_str), "Dummy VM")
    else:
        conn = manager.get_connection()
        try:
            dom = conn.lookupByUUIDString(uuid_str)
            vm_name = dom.name()
        except Exception:
            raise HTTPException(status_code=404, detail="VM not found")
            
    # Rule A & B Enforcement: Core-Masked Directory Intake
    if vm_name == "Rangda's VM":
        # Rule B: Only expose ONE directory node
        if path != "~/Downloads/Unassigned_Intake":
            return [
                {"name": "Downloads", "type": "dir", "path": "~/Downloads"},
                {"name": "Unassigned_Intake", "type": "dir", "path": "~/Downloads/Unassigned_Intake"}
            ]
        else:
            return [{"name": "empty_holding_tank.txt", "type": "file", "path": "~/Downloads/Unassigned_Intake/empty_holding_tank.txt"}]

    # Return Mock for generic VMs in Sandbox
    return MOCK_FILE_TREE

@router.post("/transfer")
async def initiate_transfer(req: TransferRequest, manager: LibvirtManager = Depends(get_libvirt_manager)):
    # Look up source and dest names
    src_name = "Unknown"
    dest_name = "Unknown"
    
    if req.source_uuid == "host": src_name = "Rangda (Host)"
    if req.dest_uuid == "host": dest_name = "Rangda (Host)"
    
    # Simple lookup logic for sandbox
    for d in manager.dummy_vms:
        if d["uuid"] == req.source_uuid: src_name = d["name"]
        if d["uuid"] == req.dest_uuid: dest_name = d["name"]
        
    if not manager.is_mock and not any(d["uuid"] == req.source_uuid for d in manager.dummy_vms):
        conn = manager.get_connection()
        try:
            dom = conn.lookupByUUIDString(req.source_uuid)
            src_name = dom.name()
            dom2 = conn.lookupByUUIDString(req.dest_uuid)
            dest_name = dom2.name()
        except:
            pass

    # Host Transfer Rules
    if src_name == "Rangda (Host)":
        if dest_name != "Rangda's VM":
            raise HTTPException(status_code=403, detail="SECURITY VIOLATION: Host can only transfer files directly to Rangda's VM, not Leyaks.")

    # Rule A Enforcement: The One-Way Valve (Egress Blocked)
    if src_name == "Rangda's VM":
        if dest_name != "Rangda (Host)":
            raise HTTPException(status_code=403, detail="SECURITY VIOLATION: Egress from Rangda's VM to Leyaks is physically blocked at the core.")
        if not req.source_path.startswith("~/Downloads") and not req.source_path.startswith("/Downloads"):
            raise HTTPException(status_code=403, detail="SECURITY VIOLATION: Rangda's VM can only egress files to Host from the authorized Intake folders.")
        if not req.dest_path.startswith("/quarantine"):
            raise HTTPException(status_code=403, detail="SECURITY VIOLATION: Files pulled from Rangda's VM to the Host must be placed strictly in the /quarantine folder.")
        
    # Generate crypto token
    token = str(uuid.uuid4())
    
    # Orchestrate P2P (Simulated via delay for Sandbox)
    # Target Preparation
    print(f"TargetPrep: Issuing guest-agent socket bind on {dest_name} with token {token}")
    await asyncio.sleep(1)
    
    # Source Trigger
    print(f"SourceTrigger: Issuing guest-agent stream to {dest_name} from {src_name}")
    await asyncio.sleep(2)
    
    # Direct Stream Complete
    print(f"DirectStream: File transferred directly. Host memory bypassed.")
    
    # Rule C Enforcement: Zero-Trust Holding Tank & chmod 600
    if dest_name == "Rangda's VM":
        print("Hook Triggered: Stripping execution permissions (chmod 600) on payload in Unassigned_Intake.")
    
    return {"status": "success", "message": "P2P Transfer Complete", "token_used": token}
