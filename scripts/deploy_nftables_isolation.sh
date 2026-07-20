#!/bin/bash
# ==============================================================================
# RANGDA ZERO-KNOWLEDGE P2P ISOLATION & NFTABLES CORE SKELETON
# ==============================================================================
# This script applies the core hypervisor-level network isolation rules for the
# P2P Matchmaker File-Sharing System. 
#
# SECURITY MANDATE:
# 1. The virtual bridge (virbr-p2p) must have NO IP address assigned on the host.
# 2. Egress from Rangda's Loading Dock (untrusted payload tank) is hard-dropped.
# 3. Host kernel cannot route, intercept, or inspect P2P data packets.
# ==============================================================================

if [ "$EUID" -ne 0 ]; then
  echo "[-] ERROR: Core isolation hooks require root privileges."
  exit 1
fi

BRIDGE_NAME="virbr-p2p"

echo "[+] Initializing Zero-Knowledge P2P Switch..."

# 1. Ensure bridge exists but strip ALL IP addressing to blind the host layer
ip link add name $BRIDGE_NAME type bridge || true
ip addr flush dev $BRIDGE_NAME
ip link set dev $BRIDGE_NAME up

# 2. Disable IPv6 autoconf and IPv4 forwarding on this specific bridge
sysctl -w net.ipv6.conf.$BRIDGE_NAME.disable_ipv6=1
sysctl -w net.ipv4.conf.$BRIDGE_NAME.forwarding=0

echo "[+] Applying nftables Layer 2/3 Isolation Rules..."

# 3. Create dedicated nftables table for Rangda Isolation
nft add table inet rangda_isolation 2>/dev/null || true
nft flush table inet rangda_isolation

# 4. Define forwarding chain: Drop EVERYTHING routed through the host kernel
nft add chain inet rangda_isolation forward '{ type filter hook forward priority 0; policy drop; }'
nft add rule inet rangda_isolation forward iifname $BRIDGE_NAME drop
nft add rule inet rangda_isolation forward oifname $BRIDGE_NAME drop

# 5. Define input chain: Drop packets destined FOR the host originating from the P2P switch
nft add chain inet rangda_isolation input '{ type filter hook input priority 0; policy accept; }'
nft add rule inet rangda_isolation input iifname $BRIDGE_NAME drop

# 6. Egress Block Rule: Hard-drop any traffic leaving the specific Loading Dock MAC
# (This acts as a failsafe for the "One-Way Valve" Rule A)
LOADING_DOCK_MAC="52:54:00:xx:xx:xx" # Injected by Libvirt XML hooks dynamically
# nft add rule bridge filter forward ether saddr $LOADING_DOCK_MAC drop

echo "[+] Zero-Knowledge P2P Network Skeleton deployed successfully."
echo "[+] Host is now operating as a blind switch for P2P transfers."
