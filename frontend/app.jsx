const { useState, useEffect } = React;

function App() {
    const [vms, setVms] = useState([]);
    const [health, setHealth] = useState(null);
    const [metrics, setMetrics] = useState(null);
    const [isos, setIsos] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [activeAudioVMs, setActiveAudioVMs] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [consoleUrl, setConsoleUrl] = useState(null);
    const [formData, setFormData] = useState({ name: '', vcpus: 2, memory_mb: 2048, storage_gb: 20, iso_path: '', avatar: 'avatar1.jpg' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sshVm, setSshVm] = useState(null);

    const availableAvatars = ['avatar1.jpg', 'avatar2.jpg', 'avatar3.jpg', 'avatar4.jpg', 'avatar5.jpg'];

    const fetchData = async () => {
        try {
            const [healthData, vmsData, metricsData, isosData, sessionsData, audioData] = await Promise.all([
                window.api.getHealth(),
                window.api.getVMs(),
                window.api.getMetrics(),
                window.api.getIsos(),
                window.api.getSessions(),
                window.api.getAudioStatus()
            ]);
            
            // Ensure Rangda's VM is always first
            const sortedVms = vmsData.sort((a, b) => {
                if (a.name === "Rangda's VM") return -1;
                if (b.name === "Rangda's VM") return 1;
                return a.name.localeCompare(b.name);
            });

            setHealth(healthData);
            setVms(sortedVms);
            setMetrics(metricsData);
            setIsos(isosData);
            setSessions(sessionsData);
            setActiveAudioVMs(audioData || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const launchNativeConsole = async (name) => {
        try {
            const res = await fetch(`/api/vms/${name}/console_native`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Failed to launch native console');
        } catch (e) {
            console.error("Native Console Error:", e);
            alert("Failed to launch Native Console: " + e.message);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 2000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!sshVm) return;
        
        const term = new Terminal({
            theme: { background: '#000000', foreground: '#ffffff', cursor: '#dc2626' },
            fontFamily: 'monospace',
            fontSize: 14
        });
        const fitAddon = new window.FitAddon.FitAddon();
        term.loadAddon(fitAddon);
        
        const container = document.getElementById('terminal-container');
        term.open(container);
        fitAddon.fit();
        
        term.writeln('\x1b[31m[RANGDA SYSTEM]\x1b[0m Securing connection to ' + sshVm.ip_address + '...');
        
        const wsUrl = `ws://${window.location.host}/api/vms/${sshVm.uuid}/ssh`;
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            term.writeln('\x1b[32m[RANGDA SYSTEM]\x1b[0m Connection Established. Handing over PTY...');
        };
        
        ws.onmessage = (event) => {
            term.write(event.data);
        };
        
        term.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(data);
            }
        });
        
        ws.onclose = () => {
            term.writeln('\r\n\x1b[31m[RANGDA SYSTEM]\x1b[0m Connection Closed.');
            setTimeout(() => setSshVm(null), 2000);
        };
        
        return () => {
            ws.close();
            term.dispose();
        };
    }, [sshVm]);

    const handleAction = async (uuid, action) => {
        try {
            await window.api.performAction(uuid, action);
            await fetchData();
        } catch (error) {
            alert(error.message);
        }
    };

    const handleCreateVM = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await window.api.createVM(formData);
            setShowModal(false);
            setFormData({ name: '', vcpus: 2, memory_mb: 2048, storage_gb: 20, iso_path: '', avatar: 'avatar1.jpg' });
            await fetchData();
        } catch (error) {
            alert(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusColor = (status) => {
        if (status === 'running') return 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]';
        if (status.includes('shut')) return 'bg-gray-400 opacity-50';
        return 'bg-yellow-500';
    };

    return (
        <div className="w-full min-h-screen overflow-hidden relative flex items-center justify-center bg-[#09090b]">
            
            {/* Global Battery Status */}
            <div className="absolute top-8 right-12 flex items-center gap-2 bg-black/60 px-4 py-2 rounded-full border border-white/10 z-50 shadow-2xl backdrop-blur-xl">
                {metrics?.battery?.charging ? (
                    <svg className="w-5 h-5 text-emerald-400 animate-pulse drop-shadow-[0_0_8px_rgba(52,211,153,1)]" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" /></svg>
                ) : (
                    <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                )}
                <span className="text-sm font-bold tracking-widest text-white">{metrics?.battery ? metrics.battery.percent : '--'}%</span>
            </div>
            {/* Background Image & Overlay */}
            <img 
                src="assets/bg.jpg" 
                alt="Background" 
                className="absolute inset-0 w-full h-full object-cover opacity-70 pointer-events-none z-0"
            />
            <div className="absolute inset-0 bg-[#09090b]/40 pointer-events-none z-0"></div>

            {/* Floating Glow Elements (Behind the Chassis) */}
            <div className="absolute -top-20 -right-20 w-[600px] h-[600px] bg-red-600/20 rounded-full blur-[140px] animate-pulse z-0 pointer-events-none"></div>
            <div className="absolute bottom-10 left-10 w-[450px] h-[450px] bg-orange-500/10 rounded-full blur-[100px] z-0 pointer-events-none"></div>

            {/* Main Chassis */}
            <div className="relative z-10 w-full max-w-[1400px] h-[85vh] rounded-3xl overflow-hidden flex bg-black/30 backdrop-blur-xl border border-white/[0.08] shadow-2xl">
                
                {/* Left Column Panel */}
                <div className="w-1/3 h-full relative border-r border-white/[0.08] flex flex-col justify-end p-8 bg-gradient-to-t from-black/60 to-transparent">
                    <img 
                        src="assets/rangda-modern.png" 
                        alt="Rangda Avatar" 
                        className="absolute inset-0 w-full h-full object-cover opacity-90 pointer-events-none -z-10"
                        style={{ objectPosition: 'center top' }}
                    />
                    
                    <div className="relative z-20 mt-auto bg-white/[0.02] backdrop-blur-md p-6 rounded-2xl border border-white/[0.08] shadow-xl">
                        <h1 className="text-2xl font-bold tracking-widest text-white/90">RANGDA</h1>
                        <h2 className="text-xs tracking-[0.3em] text-ruby-glow glow-text mb-4">CORE HYPERVISOR v2</h2>
                        
                        <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${health?.status === 'ok' ? 'bg-ruby shadow-[0_0_12px_#ef4444] animate-pulse' : 'bg-red-900'}`}></div>
                            <span className="text-sm text-white/60 uppercase tracking-wider">
                                {health?.status === 'ok' ? 'System Online' : 'System Offline'}
                            </span>
                            {health?.libvirt_mock_mode && (
                                <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded ml-auto border border-yellow-500/30">MOCK</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Content Panel */}
                <div className="w-2/3 h-full p-8 flex flex-col gap-6 overflow-y-auto relative">
                    
                    {/* Host Resource Widgets */}
                    <div className="grid grid-cols-3 gap-6">
                        <div className="bg-white/[0.02] backdrop-blur-md p-6 rounded-2xl border border-white/[0.08]">
                            <h3 className="text-white/50 text-xs uppercase tracking-wider mb-2">Memory Allocation</h3>
                            <div className="text-3xl font-light mb-4 text-white/90">
                                {metrics ? metrics.memory.used_gb : '--'} <span className="text-sm text-white/40">/ {metrics ? metrics.memory.total_gb : '--'} GB</span>
                            </div>
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-ruby rounded-full shadow-[0_0_10px_#ef4444] transition-all duration-700" style={{ width: `${metrics ? metrics.memory.percent : 0}%` }}></div>
                            </div>
                        </div>
                        <div className="bg-white/[0.02] backdrop-blur-md p-6 rounded-2xl border border-white/[0.08]">
                            <h3 className="text-white/50 text-xs uppercase tracking-wider mb-2">Active Cores</h3>
                            <div className="text-3xl font-light mb-4 text-white/90">
                                {metrics ? metrics.cpu.percent : '--'}% <span className="text-sm text-white/40">Load ({metrics ? metrics.cpu.cores : '--'} Threads)</span>
                            </div>
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full shadow-[0_0_10px_#3b82f6] transition-all duration-700" style={{ width: `${metrics ? metrics.cpu.percent : 0}%` }}></div>
                            </div>
                        </div>
                        <div className="bg-white/[0.02] backdrop-blur-md p-6 rounded-2xl border border-white/[0.08]">
                            <h3 className="text-white/50 text-xs uppercase tracking-wider mb-2">Storage Allocation</h3>
                            <div className="text-3xl font-light mb-4 text-white/90">
                                {metrics?.storage ? metrics.storage.used_gb : '--'} <span className="text-sm text-white/40">/ {metrics?.storage ? metrics.storage.total_gb : '--'} GB</span>
                            </div>
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full shadow-[0_0_10px_#10b981] transition-all duration-700" style={{ width: `${metrics?.storage ? metrics.storage.percent : 0}%` }}></div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mt-4">
                        <h3 className="text-white/70 text-sm uppercase tracking-widest">Virtual Domains</h3>
                        <button 
                            onClick={() => setShowModal(true)} 
                            className="text-xs uppercase tracking-wider bg-white/[0.03] border border-white/[0.08] px-4 py-2 rounded hover:bg-white/[0.08] transition-all text-white/90 hover:text-white flex items-center gap-2 shadow-lg"
                        >
                            <span className="text-ruby text-lg leading-none">+</span> Summon Leyak
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex-1 flex items-center justify-center text-white/50 tracking-wider text-sm uppercase animate-pulse">
                            Loading telemetry...
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            {vms.map(vm => (
                                <div key={vm.uuid} className={`backdrop-blur-md p-5 rounded-xl border flex gap-5 transition-all relative overflow-hidden ${
                                    vm.name === "Rangda's VM" 
                                        ? "bg-ruby/5 border-ruby/60 shadow-[0_0_30px_rgba(220,38,38,0.25)] hover:shadow-[0_0_45px_rgba(220,38,38,0.4)]" 
                                        : "bg-yellow-500/5 border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.15)] hover:shadow-[0_0_30px_rgba(234,179,8,0.3)] hover:bg-yellow-500/10 hover:border-yellow-500/70"
                                }`}>
                                    
                                    {/* Rangda Core Aura Overlay */}
                                    {vm.name === "Rangda's VM" && (
                                        <div className="absolute inset-0 bg-gradient-to-br from-ruby/20 via-transparent to-transparent pointer-events-none animate-pulse"></div>
                                    )}

                                    {/* Role Tag (Rangda / Leyak) */}
                                    <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-lg text-[10px] font-bold tracking-widest uppercase z-10 ${vm.name === "Rangda's VM" ? 'bg-ruby text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]' : 'bg-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.5)]'}`}>
                                        {vm.name === "Rangda's VM" ? "RANGDA" : "LEYAK"}
                                    </div>

                                    {/* Left Side: Avatar Image */}
                                    <div className="w-1/3 shrink-0 rounded-lg overflow-hidden border border-white/10 relative">
                                        <img src={`assets/avatars/${vm.avatar || 'avatar1.jpg'}`} alt={vm.name} className="absolute inset-0 w-full h-full object-cover opacity-80" />
                                        {/* Status Dot Overlay */}
                                        <div className="absolute top-2 right-2">
                                            <div className={`w-3 h-3 rounded-full ${getStatusColor(vm.status)}`}></div>
                                        </div>
                                    </div>

                                    {/* Right Side: Information & Actions */}
                                    <div className="flex-1 flex flex-col">
                                        <div className="mb-4">
                                            <h4 className="font-semibold text-lg text-white/90 truncate" title={vm.name}>{vm.name}</h4>
                                            <p className="text-xs text-white/40 font-mono mt-1" title={vm.uuid}>
                                                {vm.uuid.split('-')[0]}...{vm.uuid.split('-').pop()}
                                            </p>
                                        </div>
                                        
                                        <div className="flex gap-4 text-sm text-white/60 mb-6">
                                            <div><span className="text-white/30 text-xs uppercase">CPU</span> {vm.vcpus}</div>
                                            <div><span className="text-white/30 text-xs uppercase">RAM</span> {Math.round(vm.memory_kb / 1024)} MB</div>
                                        </div>

                                    <div className="mt-auto flex flex-col gap-2">
                                        {vm.status !== 'running' && (
                                            <button 
                                                onClick={() => handleAction(vm.uuid, 'start')}
                                                className="w-full bg-white/[0.04] hover:bg-white/[0.1] transition-colors py-2 rounded text-xs tracking-wider uppercase font-medium border border-white/[0.08] hover:border-white/[0.2] text-white/80 hover:text-white"
                                            >
                                                Start
                                            </button>
                                        )}
                                        {vm.status === 'running' && (
                                            <div className="flex flex-col gap-2 w-full">
                                                <div className="flex gap-2">
                                                    <button 
                                                        onClick={() => launchNativeConsole(vm.name)}
                                                        className={`flex-1 bg-blue-600/80 hover:bg-blue-500 transition-colors py-2 rounded text-xs tracking-wider uppercase font-medium shadow-[0_0_15px_rgba(59,130,246,0.3)] text-white`}
                                                    >
                                                        Console
                                                    </button>
                                                    <button 
                                                        onClick={() => setSshVm(vm)}
                                                        className="flex-1 bg-emerald-600/80 hover:bg-emerald-500 transition-colors py-2 rounded text-xs tracking-wider uppercase font-medium text-center shadow-[0_0_15px_rgba(16,185,129,0.3)] text-white flex items-center justify-center"
                                                    >
                                                        SSH
                                                    </button>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleAction(vm.uuid, 'reboot')} className="flex-1 bg-white/[0.04] hover:bg-white/[0.1] transition-colors py-2 rounded text-xs tracking-wider uppercase font-medium border border-white/[0.08] hover:border-white/[0.2] text-white/70 hover:text-white">Reboot</button>
                                                    <button onClick={() => handleAction(vm.uuid, 'shutdown')} className="flex-1 bg-white/[0.04] hover:bg-ruby/20 transition-colors py-2 rounded text-xs tracking-wider uppercase font-medium border border-white/[0.08] hover:border-ruby/50 text-white/70 hover:text-ruby">Shutdown</button>
                                                    <button 
                                                        onClick={() => handleAction(vm.uuid, 'destroy')} 
                                                        disabled={vm.name === "Rangda's VM"}
                                                        className={`flex-1 transition-colors py-2 rounded text-xs tracking-wider uppercase font-medium text-white ${vm.name === "Rangda's VM" ? 'opacity-30 cursor-not-allowed bg-gray-500' : 'bg-ruby/80 hover:bg-ruby shadow-[0_0_15px_rgba(220,38,38,0.3)]'}`}
                                                    >
                                                        {vm.name === "Rangda's VM" ? "LOCKED" : "Kill"}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    </div>
                                </div>
                            ))}
                            {vms.length === 0 && (
                                <div className="col-span-2 text-center text-white/30 py-8 border border-dashed border-white/[0.08] rounded-xl tracking-wider text-sm bg-white/[0.01]">
                                    No virtual machines found.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Create VM Modal Overlay */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-white/[0.02] border border-white/10 shadow-2xl p-6 rounded-xl max-w-md w-full relative">
                        <h2 className="text-xl font-semibold mb-6 tracking-wide text-white/90">Summon New Leyak</h2>
                        <form onSubmit={handleCreateVM} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-xs uppercase text-white/50 mb-1 tracking-wider">Instance Name</label>
                                <input 
                                    type="text" required 
                                    value={formData.name} 
                                    onChange={e => setFormData({...formData, name: e.target.value})} 
                                    className="w-full bg-black/20 border border-white/10 text-white rounded p-3 text-sm outline-none focus:border-ruby/50 transition-colors backdrop-blur-sm" 
                                    placeholder="e.g. ubuntu-server-01" 
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs uppercase text-white/50 mb-1 tracking-wider">vCPUs</label>
                                    <input 
                                        type="number" required min="1" 
                                        value={formData.vcpus} 
                                        onChange={e => setFormData({...formData, vcpus: parseInt(e.target.value)})} 
                                        className="w-full bg-black/20 border border-white/10 text-white rounded p-3 text-sm outline-none focus:border-ruby/50 transition-colors backdrop-blur-sm" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs uppercase text-white/50 mb-1 tracking-wider">Memory (MB)</label>
                                    <input 
                                        type="number" required min="512" step="512" 
                                        value={formData.memory_mb} 
                                        onChange={e => setFormData({...formData, memory_mb: parseInt(e.target.value)})} 
                                        className="w-full bg-black/20 border border-white/10 text-white rounded p-3 text-sm outline-none focus:border-ruby/50 transition-colors backdrop-blur-sm" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs uppercase text-white/50 mb-1 tracking-wider">Storage (GB)</label>
                                    <input 
                                        type="number" required min="5" step="1" 
                                        value={formData.storage_gb} 
                                        onChange={e => setFormData({...formData, storage_gb: parseInt(e.target.value)})} 
                                        className="w-full bg-black/20 border border-white/10 text-white rounded p-3 text-sm outline-none focus:border-ruby/50 transition-colors backdrop-blur-sm" 
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs uppercase text-white/50 mb-1 tracking-wider">Installation Media</label>
                                <select 
                                    required
                                    value={formData.iso_path} 
                                    onChange={e => setFormData({...formData, iso_path: e.target.value})} 
                                    className="w-full bg-black/20 border border-white/10 text-white rounded p-3 text-sm outline-none focus:border-ruby/50 transition-colors backdrop-blur-sm appearance-none"
                                >
                                    <option value="" disabled>Select an ISO...</option>
                                    {isos.map((iso, idx) => (
                                        <option key={idx} value={iso} className="bg-gray-900 text-white">{iso.split('/').pop()}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs uppercase text-white/50 mb-1 tracking-wider">Select Avatar</label>
                                <div className="flex gap-3 overflow-x-auto pb-2">
                                    {availableAvatars.map(av => (
                                        <div 
                                            key={av} 
                                            onClick={() => setFormData({...formData, avatar: av})}
                                            className={`w-16 h-16 shrink-0 rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${formData.avatar === av ? 'border-ruby shadow-[0_0_10px_#ef4444]' : 'border-transparent hover:border-white/30'}`}
                                        >
                                            <img src={`assets/avatars/${av}`} alt="Avatar option" className="w-full h-full object-cover" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end gap-3">
                                <button 
                                    type="button" 
                                    onClick={() => setShowModal(false)} 
                                    className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors uppercase tracking-wider"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSubmitting}
                                    className="px-6 py-2 text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded transition-all text-ruby hover:text-ruby-glow shadow-[0_0_10px_rgba(220,38,38,0.2)] uppercase tracking-wider disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Summoning...' : 'Summon Leyak'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}


            {/* SSH Terminal Modal */}
            {sshVm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#111] border border-white/10 p-6 rounded-lg shadow-2xl w-[900px] flex flex-col relative">
                        <button onClick={() => setSshVm(null)} className="absolute top-4 right-4 text-white/50 hover:text-ruby">✕</button>
                        <h2 className="text-xl font-bold tracking-widest uppercase text-white/90 mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-ruby animate-pulse"></span>
                            Secure Shell: {sshVm.name}
                        </h2>
                        <div className="w-full h-[500px] bg-black rounded border border-white/5 p-2 overflow-hidden" id="terminal-container">
                        </div>
                    </div>
                </div>
            )}
            
            {/* P2P Matchmaker File-Sharing Panel (Disabled per user request) */}
            {/* <window.P2PPanel vms={vms} /> */}

            {/* Active Sessions Tray */}
            <div className="absolute top-1/2 -translate-y-1/2 left-8 z-50 flex flex-col gap-4 bg-black/40 backdrop-blur-xl border border-white/10 p-3 rounded-full shadow-2xl">
                {sessions.map(s => (
                    <button 
                        key={s.id} 
                        onClick={() => window.api.activateSession(s.id)}
                        className="w-12 h-12 rounded-full overflow-hidden border border-white/10 hover:border-white/50 hover:scale-110 transition-all duration-300 group relative flex items-center justify-center bg-black"
                        title={`Resume ${s.title}`}
                    >
                        {s.type === 'obs' ? (
                            <svg className="w-6 h-6 text-white/80 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        ) : (
                            <img 
                                src={`assets/avatars/${vms.find(v => v.name === s.title)?.avatar || 'avatar1.jpg'}`} 
                                alt={s.title} 
                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100" 
                            />
                        )}
                    </button>
                ))}
            </div>

            {/* Quarantine Pet 2 / Cute Pinch */}
            <div className="absolute -top-8 left-0 z-50 pointer-events-none">
                <img src="assets/moè-moèfear.gif" alt="Cute Pinch" className="w-64 h-auto opacity-90 drop-shadow-2xl mix-blend-screen scale-x-[-1] scale-y-[-1]" />
            </div>

            {/* Quarantine Pet / Cool Verycute */}
            <div className="absolute -bottom-4 left-0 z-50 pointer-events-none">
                <img src="assets/cool-verycute.gif" alt="Cool Very Cute" className="w-64 h-auto opacity-90 drop-shadow-2xl mix-blend-screen" />
            </div>

            {/* OBS Studio Launch Button */}
            <button 
                onClick={() => fetch('http://127.0.0.1:8000/api/host/launch-obs', { method: 'POST' })}
                className="absolute bottom-8 right-12 z-50 p-4 rounded-full bg-black/60 border border-white/10 hover:bg-white/10 hover:border-white/30 transition-all duration-300 shadow-2xl backdrop-blur-xl group cursor-pointer"
                title="Launch OBS Studio"
            >
                <svg className="w-6 h-6 text-white/60 group-hover:text-red-400 transition-colors drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            </button>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
