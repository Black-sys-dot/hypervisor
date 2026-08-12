# Rangda Core Hypervisor Dashboard

> **Note**: The newly created `sanitized-source` branch contains the full and latest code. Please switch to that branch for the most up-to-date features and fixes.

Rangda Core Hypervisor is a specialized, interactive virtual machine management and network isolation platform. It provides a React-based web dashboard interfacing with a FastAPI backend that securely orchestrates `libvirt`/KVM virtual machines. 

The system features robust zero-knowledge network isolation through dedicated `nftables` rules, enabling secure "intake" environments to validate untrusted assets safely.

## Features

- **Hypervisor Management**: Provision, manage, and monitor libvirt/KVM virtual machines dynamically.
- **Modern Web Dashboard**: Real-time React dashboard with host metrics, VM resource allocation, and integrated noVNC web console.
- **Secure Intake Node**: Automated daemon and isolated environment configuration to safely ingest and verify ISOs and disk images before committing them to production hypervisor storage.
- **Zero-Knowledge Network Isolation**: Pre-configured NFTables scripts (`deploy_nftables_isolation.sh`) that strictly enforce bridge isolation, ensuring no untrusted virtual network traffic escapes to the host kernel.
- **Hardware Metrics & Monitoring**: Live tracking of host CPU, memory, storage, battery, and GPU utilization.

## Repository Structure

- `backend/`: FastAPI Python backend interacting with `libvirt` and providing REST endpoints for the dashboard.
- `frontend/`: React single-page application and assets for the dashboard UI.
- `intake-node/`: Specialized VM definitions (`intake_vm.xml`) and watcher daemons (`watcher_daemon.py`, `host_webhook.py`) to manage secure asset intake and quarantine.
- `scripts/`: Initialization (`rangda-activate`) and security setup scripts.
- `deployment/`: Systemd service files for persisting the backend API.
- `.config/`: Dedicated Openbox window manager configurations for running the dashboard in kiosk mode.

## Installation & Setup

1. **Prerequisites**: Ensure you have Python 3, `libvirt`, `qemu-kvm`, and `nftables` installed on your host system.
2. **Environment Variables**: The system dynamically loads resources using the following environment variables (falling back to relative paths if unset):
   - `RANGDA_STORAGE_DIR`: Path to VM storage volumes (e.g., `.qcow2` files).
   - `RANGDA_BOOT_DIR`: Path to boot ISOs.
   - `RANGDA_IMAGES_DIR`: Path to managed virtual machine images.
3. **Backend Setup**:
   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
4. **Start the Platform**: Use the provided activation script to launch the backend and open the dashboard in Chromium kiosk mode:
   ```bash
   ./scripts/rangda-activate
   ```

## Security Design

Rangda employs a strictly sandboxed network topology:
- **Intake Pipeline**: Suspicious or new assets are first passed into a dedicated `vault_share` Virtio-FS mount inside the Intake VM. 
- **Validation Handshake**: Only upon validation by the isolated `watcher_daemon` does the system webhook trigger the host to ingest the file.
- **NFTables Bridge Isolation**: The `virbr-p2p` bridge is intentionally blinded from the host. Egress traffic is strictly dropped, making the host act merely as an invisible switch.
