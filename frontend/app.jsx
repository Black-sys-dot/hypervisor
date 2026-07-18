const { useState, useEffect } = React;

function App() {
    const [vms, setVms] = useState([]);
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [healthData, vmsData] = await Promise.all([
                window.api.getHealth(),
                window.api.getVMs()
            ]);
            setHealth(healthData);
            setVms(vmsData);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
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

    const getStatusColor = (status) => {
        if (status === 'running') return 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]';
        if (status.includes('shut')) return 'bg-gray-400 opacity-50';
        return 'bg-yellow-500';
    };

    return (
        <div className="w-full min-h-screen overflow-hidden relative flex items-center justify-center bg-[#09090b]">
            
            {/* Floating Glow Elements (Behind the Chassis) */}
            <div className="absolute -top-20 -right-20 w-[600px] h-[600px] bg-red-600/20 rounded-full blur-[140px] animate-pulse z-0 pointer-events-none"></div>
            <div className="absolute bottom-10 left-10 w-[450px] h-[450px] bg-orange-500/10 rounded-full blur-[100px] z-0 pointer-events-none"></div>

            {/* Main Chassis */}
            <div className="relative z-10 w-full max-w-[1400px] h-[85vh] rounded-3xl overflow-hidden flex bg-black/30 backdrop-blur-xl border border-white/[0.08] shadow-2xl">
                
                {/* Left Column Panel */}
                <div className="w-1/3 h-full relative border-r border-white/[0.08] flex flex-col justify-end p-8 bg-gradient-to-t from-black/60 to-transparent">
                    {/* Character Asset */}
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
                            <div className="text-3xl font-light mb-4 text-white/90">16.4 <span className="text-sm text-white/40">GB</span></div>
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-ruby w-[45%] rounded-full shadow-[0_0_10px_#ef4444]"></div>
                            </div>
                        </div>
                        <div className="bg-white/[0.02] backdrop-blur-md p-6 rounded-2xl border border-white/[0.08]">
                            <h3 className="text-white/50 text-xs uppercase tracking-wider mb-2">Active Cores</h3>
                            <div className="text-3xl font-light mb-4 text-white/90">12 <span className="text-sm text-white/40">/ 32</span></div>
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 w-[30%] rounded-full shadow-[0_0_10px_#3b82f6]"></div>
                            </div>
                        </div>
                    </div>

                    <h3 className="text-white/70 text-sm uppercase tracking-widest mt-4">Virtual Domains</h3>

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

                                    <div className="mt-auto flex gap-2">
                                        {vm.status !== 'running' && (
                                            <button 
                                                onClick={() => handleAction(vm.uuid, 'start')}
                                                className="flex-1 bg-white/[0.04] hover:bg-white/[0.1] transition-colors py-2 rounded text-xs tracking-wider uppercase font-medium border border-white/[0.08] hover:border-white/[0.2] text-white/80 hover:text-white"
                                            >
                                                Start
                                            </button>
                                        )}
                                        {vm.status === 'running' && (
                                            <>
                                                <button 
                                                    onClick={() => handleAction(vm.uuid, 'reboot')}
                                                    className="flex-1 bg-white/[0.04] hover:bg-white/[0.1] transition-colors py-2 rounded text-xs tracking-wider uppercase font-medium border border-white/[0.08] hover:border-white/[0.2] text-white/70 hover:text-white"
                                                >
                                                    Reboot
                                                </button>
                                                <button 
                                                    onClick={() => handleAction(vm.uuid, 'shutdown')}
                                                    className="flex-1 bg-white/[0.04] hover:bg-ruby/20 transition-colors py-2 rounded text-xs tracking-wider uppercase font-medium border border-white/[0.08] hover:border-ruby/50 text-white/70 hover:text-ruby"
                                                >
                                                    Shutdown
                                                </button>
                                                <button 
                                                    onClick={() => handleAction(vm.uuid, 'destroy')}
                                                    className="flex-1 bg-ruby/80 hover:bg-ruby transition-colors py-2 rounded text-xs tracking-wider uppercase font-medium shadow-[0_0_15px_rgba(220,38,38,0.3)] text-white"
                                                >
                                                    Kill
                                                </button>
                                            </>
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
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
