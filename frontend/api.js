const API_BASE = '/api';

const api = {
    async getHealth() {
        try {
            const res = await fetch(`${API_BASE}/health`);
            return await res.json();
        } catch (e) {
            console.error("Health check failed", e);
            return { status: 'error' };
        }
    },
    
    async getVMs() {
        const res = await fetch(`${API_BASE}/vms`);
        if (!res.ok) throw new Error("Failed to fetch VMs");
        return await res.json();
    },
    
    async performAction(uuid, action) {
        const res = await fetch(`${API_BASE}/vms/${uuid}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });
        if (!res.ok) throw new Error(`Failed to ${action} VM`);
        return await res.json();
    },
    
    async getMetrics() {
        try {
            const res = await fetch(`${API_BASE}/host/metrics`);
            return await res.json();
        } catch (e) {
            console.error("Metrics check failed", e);
            return null;
        }
    },
    
    async createVM(vmData) {
        const res = await fetch(`${API_BASE}/vms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(vmData)
        });
        if (!res.ok) throw new Error("Failed to create VM");
        return await res.json();
    },
    
    async getIsos() {
        try {
            const res = await fetch(`${API_BASE}/storage/isos`);
            return await res.json();
        } catch (e) {
            console.error("ISO fetch failed", e);
            return [];
        }
    },

    async getVMFiles(uuid, path = "/") {
        const res = await fetch(`${API_BASE}/p2p/${uuid}/files?path=${encodeURIComponent(path)}`);
        if (!res.ok) throw new Error("Failed to fetch VM files or Access Denied");
        return await res.json();
    },

    async transferP2P(transferData) {
        const res = await fetch(`${API_BASE}/p2p/transfer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transferData)
        });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.detail || "P2P Transfer Failed");
        }
        return await res.json();
    }
};

window.api = api;
