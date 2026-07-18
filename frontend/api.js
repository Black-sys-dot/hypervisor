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
    }
};

window.api = api;
