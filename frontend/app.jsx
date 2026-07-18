const { useState, useEffect } = React;

function App() {
    const [vms, setVms] = useState([]);
    const [health, setHealth] = useState(null);
    const [metrics, setMetrics] = useState(null);
    const [isos, setIsos] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [consoleUrl, setConsoleUrl] = useState(null);
    const [formData, setFormData] = useState({ name: '', vcpus: 2, memory_mb: 2048, iso_path: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchData = async () => {
        try {
            const [healthData, vmsData, metricsData, isosData] = await Promise.all([
                window.api.getHealth(),
                window.api.getVMs(),
                window.api.getMetrics(),
                window.api.getIsos()
            ]);
            setHealth(healthData);
            setVms(vmsData);
            setMetrics(metricsData);
            setIsos(isosData);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 4000);
        return () => clearInterval(interval);
    }, []);

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
            setFormData({ name: '', vcpus: 2, memory_mb: 2048, iso_path: '' });
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
                    <div className="grid grid-cols-2 gap-6">
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
                    </div>

                    <div className="flex justify-between items-center mt-4">
                        <h3 className="text-white/70 text-sm uppercase tracking-widest">Virtual Domains</h3>
                        <button 
                            onClick={() => setShowModal(true)} 
                            className="text-xs uppercase tracking-wider bg-white/[0.03] border border-white/[0.08] px-4 py-2 rounded hover:bg-white/[0.08] transition-all text-white/90 hover:text-white flex items-center gap-2 shadow-lg"
                        >
                            <span className="text-ruby text-lg leading-none">+</span> Provision VM
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex-1 flex items-center justify-center text-white/50 tracking-wider text-sm uppercase animate-pulse">
                            Loading telemetry...
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            {vms.map(vm => (
                                <div key={vm.uuid} className="bg-white/[0.02] backdrop-blur-md p-5 rounded-xl border border-white/[0.08] flex flex-col hover:bg-white/[0.05] hover:border-white/[0.15] transition-all">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h4 className="font-semibold text-lg text-white/90">{vm.name}</h4>
                                            <p className="text-xs text-white/40 font-mono mt-1" title={vm.uuid}>
                                                {vm.uuid.split('-')[0]}...{vm.uuid.split('-').pop()}
                                            </p>
                                        </div>
                                        <div className={`w-3 h-3 rounded-full ${getStatusColor(vm.status)}`}></div>
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
                                                    {vm.ws_port && (
                                                        <button 
                                                            onClick={() => setConsoleUrl(`/dashboard/console.html?ws=${vm.ws_port}`)}
                                                            className="flex-1 bg-blue-600/80 hover:bg-blue-500 transition-colors py-2 rounded text-xs tracking-wider uppercase font-medium shadow-[0_0_15px_rgba(59,130,246,0.3)] text-white"
                                                        >
                                                            Console
                                                        </button>
                                                    )}
                                                    {vm.ip_address && (
                                                        <a 
                                                            href={`ssh://root@${vm.ip_address}`}
                                                            className="flex-1 bg-emerald-600/80 hover:bg-emerald-500 transition-colors py-2 rounded text-xs tracking-wider uppercase font-medium text-center shadow-[0_0_15px_rgba(16,185,129,0.3)] text-white flex items-center justify-center"
                                                        >
                                                            SSH
                                                        </a>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleAction(vm.uuid, 'reboot')} className="flex-1 bg-white/[0.04] hover:bg-white/[0.1] transition-colors py-2 rounded text-xs tracking-wider uppercase font-medium border border-white/[0.08] hover:border-white/[0.2] text-white/70 hover:text-white">Reboot</button>
                                                    <button onClick={() => handleAction(vm.uuid, 'shutdown')} className="flex-1 bg-white/[0.04] hover:bg-ruby/20 transition-colors py-2 rounded text-xs tracking-wider uppercase font-medium border border-white/[0.08] hover:border-ruby/50 text-white/70 hover:text-ruby">Shutdown</button>
                                                    <button onClick={() => handleAction(vm.uuid, 'destroy')} className="flex-1 bg-ruby/80 hover:bg-ruby transition-colors py-2 rounded text-xs tracking-wider uppercase font-medium shadow-[0_0_15px_rgba(220,38,38,0.3)] text-white">Kill</button>
                                                </div>
                                            </div>
                                        )}
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
                        <h2 className="text-xl font-semibold mb-6 tracking-wide text-white/90">Provision New Instance</h2>
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
                            <div className="grid grid-cols-2 gap-4">
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
                                        <option key={idx} value={`/var/lib/libvirt/boot/${iso}`} className="bg-gray-900 text-white">{iso}</option>
                                    ))}
                                </select>
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
                                    {isSubmitting ? 'Provisioning...' : 'Provision VM'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Console Modal Overlay */}
            {consoleUrl && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex flex-col p-8">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold tracking-widest text-white/90">VM CONSOLE</h2>
                        <button onClick={() => setConsoleUrl(null)} className="text-white/50 hover:text-ruby transition-colors text-4xl leading-none">&times;</button>
                    </div>
                    <div className="flex-1 bg-black rounded-xl overflow-hidden border border-white/[0.08] shadow-[0_0_50px_rgba(0,0,0,0.8)] relative">
                        <iframe src={consoleUrl} className="absolute inset-0 w-full h-full border-0"></iframe>
                    </div>
                </div>
            )}
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
