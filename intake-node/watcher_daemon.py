#!/usr/bin/env python3
"""
Rangda Interactive Intake Node - Watcher Daemon
Runs inside the GUI EndeavourOS Intake VM.
Monitors ~/Downloads/Intake/* directories linked via virtio-fs.
"""

import os
import time
import subprocess
import requests
import stat
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Ensure paths expand to the guest user's home directory
VAULT_DIR = os.path.expanduser("~/Downloads/Intake/Trusted_Images")
QUARANTINE_DIR = os.path.expanduser("~/Downloads/Intake/Quarantine_Assets")

# Internal NAT IP of the Host machine (Default libvirt bridge gateway)
HOST_WEBHOOK_URL = "http://192.168.122.1:8000/api/intake/webhook"
ALLOWED_EXTS = {'.iso', '.qcow2', '.img', '.raw'}

def check_mime_type(filepath):
    """Uses the linux 'file' utility to assert basic MIME type safety."""
    try:
        mime = subprocess.check_output(['file', '-b', '--mime-type', filepath]).decode().strip()
        if "text/x-shellscript" in mime or "executable" in mime:
            return False
        return True
    except Exception:
        return False

class IntakeDockHandler(FileSystemEventHandler):
    
    def on_closed(self, event):
        # We use on_closed (IN_CLOSE_WRITE) to ensure the file transfer has finished downloading/copying
        if event.is_directory:
            return
            
        filepath = event.src_path
        
        if filepath.startswith(VAULT_DIR):
            self.process_vault_intake(filepath)
        elif filepath.startswith(QUARANTINE_DIR):
            self.process_quarantine_intake(filepath)

    def process_vault_intake(self, filepath):
        print(f"[VAULT] Processing new asset: {filepath}")
        ext = os.path.splitext(filepath)[1].lower()
        
        # 1. Extension Guard
        if ext not in ALLOWED_EXTS:
            print(f"[VAULT] REJECTED: Invalid extension {ext}")
            os.remove(filepath)
            return
            
        # 2. MIME Type Guard
        if not check_mime_type(filepath):
            print(f"[VAULT] REJECTED: Failed MIME/Header validation")
            os.remove(filepath)
            return
            
        # 3. Validation Passed -> Signal Host to officially ingest
        filename = os.path.basename(filepath)
        print(f"[VAULT] VALIDATED: Signaling host for {filename}")
        try:
            requests.post(HOST_WEBHOOK_URL, json={
                "filename": filename,
                "status": "verified_safe",
                "asset_type": "boot_image"
            }, timeout=5)
        except requests.exceptions.RequestException as e:
            print(f"[VAULT] Webhook failed: {e}")

    def process_quarantine_intake(self, filepath):
        print(f"[QUARANTINE] Isolating new asset: {filepath}")
        try:
            # Strip all execution permissions, leave as read-write for owner only (600)
            os.chmod(filepath, stat.S_IRUSR | stat.S_IWUSR)
            print(f"[QUARANTINE] Permissions stripped to 600 for {filepath}")
            # Note: Host strictly manages this directory; daemon neutralizes execution inside the VM.
        except Exception as e:
            print(f"[QUARANTINE] Failed to strip permissions: {e}")

if __name__ == "__main__":
    # Ensure local guest directories exist
    os.makedirs(VAULT_DIR, exist_ok=True)
    os.makedirs(QUARANTINE_DIR, exist_ok=True)
    
    observer = Observer()
    observer.schedule(IntakeDockHandler(), VAULT_DIR, recursive=False)
    observer.schedule(IntakeDockHandler(), QUARANTINE_DIR, recursive=False)
    
    print("Rangda GUI Intake Daemon active and watching ~/Downloads/Intake/ ...")
    observer.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()
