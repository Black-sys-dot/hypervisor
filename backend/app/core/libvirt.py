import logging
from typing import List, Optional, Dict, Any
import uuid

try:
    import libvirt
    HAS_LIBVIRT = True
except ImportError:
    HAS_LIBVIRT = False

logger = logging.getLogger(__name__)

# Mock Classes for Fallback
class MockDomain:
    def __init__(self, name: str, id: int, uuid_str: str, state: int):
        self._name = name
        self._id = id
        self._uuid_str = uuid_str
        self._state = state
        self._vcpus = 2
        self._memory = 2048 * 1024 # 2048 MB in KB
    
    def ID(self) -> int:
        return self._id
        
    def name(self) -> str:
        return self._name
        
    def UUIDString(self) -> str:
        return self._uuid_str
        
    def state(self) -> List[int]:
        # Returns [state, reason]
        return [self._state, 1]
        
    def maxMemory(self) -> int:
        return self._memory
        
    def vcpusFlags(self, flags: int = 0) -> int:
        return self._vcpus

    def create(self) -> int:
        self._state = 1 # Running (mock)
        return 0
        
    def shutdown(self) -> int:
        self._state = 5 # Shut off (mock)
        return 0
        
    def destroy(self) -> int:
        self._state = 5
        return 0
        
    def reboot(self, flags: int = 0) -> int:
        self._state = 1
        return 0


class MockLibvirtConnection:
    def __init__(self):
        self._domains = [
            MockDomain("mock-ubuntu-server", 1, str(uuid.uuid4()), 1),
            MockDomain("mock-windows-11", 2, str(uuid.uuid4()), 5),
            MockDomain("mock-alpine-docker", 3, str(uuid.uuid4()), 3),
        ]
        
    def listAllDomains(self, flags: int = 0) -> List[MockDomain]:
        return self._domains

    def lookupByUUIDString(self, uuid_str: str) -> Optional[MockDomain]:
        for dom in self._domains:
            if dom.UUIDString() == uuid_str:
                return dom
        if HAS_LIBVIRT:
            raise libvirt.libvirtError("Domain not found")
        else:
            raise Exception("Domain not found")
            
    def create_mock_domain(self, name: str, vcpus: int, memory_kb: int) -> MockDomain:
        new_id = len(self._domains) + 1
        dom = MockDomain(name, new_id, str(uuid.uuid4()), 5) # 5 = shut off initially
        dom._vcpus = vcpus
        dom._memory = memory_kb
        self._domains.append(dom)
        return dom

    def close(self) -> int:
        return 0

class LibvirtManager:
    def __init__(self):
        self.conn = None
        self.is_mock = False
        self.dummy_vms = [] # Stores fake VMs when safe-locks prevent real creation

    def connect(self):
        if HAS_LIBVIRT:
            try:
                # Try connecting to the system libvirt daemon
                self.conn = libvirt.open('qemu:///system')
                if self.conn is None:
                    raise Exception("Failed to open connection to qemu:///system")
                self.is_mock = False
                logger.info("Successfully connected to libvirt (qemu:///system).")
                return
            except libvirt.libvirtError as e:
                logger.warning(f"Failed to connect to libvirt: {e}. Falling back to Mock Storage.")
        else:
            logger.warning("libvirt-python not installed. Falling back to Mock Storage.")
            
        # Fallback to mock
        self.conn = MockLibvirtConnection()
        self.is_mock = True

    def disconnect(self):
        if self.conn:
            try:
                self.conn.close()
                logger.info("Libvirt connection closed.")
            except Exception as e:
                logger.error(f"Error closing libvirt connection: {e}")
            finally:
                self.conn = None

    def get_connection(self):
        if not self.conn:
            self.connect()
        return self.conn

# Global instance manager
libvirt_manager = LibvirtManager()

def get_libvirt_manager() -> LibvirtManager:
    return libvirt_manager
