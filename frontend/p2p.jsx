const { useState, useEffect } = React;

window.P2PPanel = function P2PPanel({ vms }) {
    const [isOpen, setIsOpen] = useState(false);
    const [leftVm, setLeftVm] = useState(null);
    const [rightVm, setRightVm] = useState(null);
    const [leftFiles, setLeftFiles] = useState([]);
    const [rightFiles, setRightFiles] = useState([]);
    const [transferStatus, setTransferStatus] = useState('idle'); // idle, transferring, complete, error
    const [errorMsg, setErrorMsg] = useState("");
    const [draggedFile, setDraggedFile] = useState(null);

    useEffect(() => {
        if (leftVm) {
            window.api.getVMFiles(leftVm)
                .then(setLeftFiles)
                .catch(e => {
                    console.error(e);
                    setLeftFiles([]);
                    setErrorMsg("Egress Blocked by Core API");
                });
        }
    }, [leftVm]);

    useEffect(() => {
        if (rightVm) {
            window.api.getVMFiles(rightVm)
                .then(setRightFiles)
                .catch(e => {
                    console.error(e);
                    setRightFiles([]);
                });
        }
    }, [rightVm]);

    const handleDragStart = (e, file) => {
        if (file.type !== 'file') {
            e.preventDefault();
            return;
        }
        setDraggedFile(file);
        e.dataTransfer.setData('text/plain', file.path);
    };

    const handleDrop = async (e, destFolder) => {
        e.preventDefault();
        if (!draggedFile || !leftVm || !rightVm) return;

        setTransferStatus('transferring');
        setErrorMsg("");
        
        try {
            await window.api.transferP2P({
                source_uuid: leftVm,
                source_path: draggedFile.path,
                dest_uuid: rightVm,
                dest_path: destFolder.path + "/" + draggedFile.name
            });
            setTransferStatus('complete');
            setTimeout(() => setTransferStatus('idle'), 3000);
            
            // Refresh right files
            const files = await window.api.getVMFiles(rightVm);
            setRightFiles(files);
        } catch (error) {
            setTransferStatus('error');
            setErrorMsg(error.message);
        }
        setDraggedFile(null);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    return (
        <>
            {/* Activation Trigger Button */}
            <button 
                onClick={() => setIsOpen(true)}
                className="fixed bottom-8 right-8 w-14 h-14 bg-ruby hover:bg-ruby-glow rounded-full shadow-[0_0_20px_rgba(220,38,38,0.5)] z-40 flex items-center justify-center transition-transform hover:scale-110"
            >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
            </button>

            {/* Frosted Glass Overlay Panel */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-8">
                    <div className="w-[1000px] h-[700px] bg-black/80 border border-white/10 rounded-2xl shadow-2xl flex flex-col relative overflow-hidden">
                        
                        <button onClick={() => setIsOpen(false)} className="absolute top-4 right-4 text-white/50 hover:text-white z-10 text-xl">✕</button>

                        {/* Top Status Hub */}
                        <div className="h-32 border-b border-white/10 flex flex-col items-center justify-center relative bg-gradient-to-b from-ruby/5 to-transparent">
                            <h2 className="text-white/80 font-bold tracking-widest uppercase mb-4 text-lg">Zero-Knowledge P2P Matchmaker</h2>
                            
                            {/* Glowing Visual Circle */}
                            <div className="relative w-16 h-16 flex items-center justify-center">
                                <div className={`absolute inset-0 rounded-full border-2 ${
                                    transferStatus === 'transferring' ? 'border-ruby shadow-[0_0_20px_#ef4444] animate-spin' :
                                    transferStatus === 'complete' ? 'border-green-500 shadow-[0_0_20px_#22c55e]' :
                                    transferStatus === 'error' ? 'border-red-600 shadow-[0_0_20px_#dc2626]' :
                                    'border-white/20'
                                }`}></div>
                                <div className="text-white/90 text-xs uppercase tracking-wider font-semibold z-10">
                                    {transferStatus === 'transferring' ? 'SYNC' :
                                     transferStatus === 'complete' ? 'DONE' :
                                     transferStatus === 'error' ? 'ERR' :
                                     'IDLE'}
                                </div>
                            </div>
                            
                            {errorMsg && (
                                <div className="absolute bottom-2 text-ruby-glow text-xs uppercase tracking-widest bg-black/50 px-3 py-1 rounded">
                                    {errorMsg}
                                </div>
                            )}
                        </div>

                        {/* Split Panes */}
                        <div className="flex-1 flex bg-black/50">
                            
                            {/* Left Pane (Source) */}
                            <div className="w-1/2 border-r border-white/10 flex flex-col p-6">
                                <div className="mb-4">
                                    <label className="block text-xs uppercase text-white/50 mb-2 tracking-wider">Source VM (Egress)</label>
                                    <select 
                                        value={leftVm || ''} 
                                        onChange={(e) => setLeftVm(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 text-white p-2 text-sm rounded outline-none focus:border-ruby/50"
                                    >
                                        <option value="" disabled>Select Source...</option>
                                        <option value="host" className="text-ruby font-bold">Rangda (Host)</option>
                                        {vms.filter(v => v.status === 'running').map(v => (
                                            <option key={v.uuid} value={v.uuid}>{v.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex-1 overflow-y-auto border border-white/5 rounded p-2 bg-white/[0.02]">
                                    {leftFiles.length === 0 ? (
                                        <div className="text-white/30 text-xs text-center mt-10 uppercase tracking-widest">No accessible files / Blocked</div>
                                    ) : (
                                        leftFiles.map((f, i) => (
                                            <div 
                                                key={i}
                                                draggable={f.type === 'file'}
                                                onDragStart={(e) => handleDragStart(e, f)}
                                                className={`p-2 flex items-center gap-3 text-sm rounded transition-colors ${f.type === 'file' ? 'hover:bg-white/10 cursor-grab text-white/80' : 'text-white/50 cursor-default'}`}
                                            >
                                                <span>{f.type === 'dir' ? '📁' : '📄'}</span>
                                                <span className="font-mono">{f.name}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Right Pane (Destination) */}
                            <div className="w-1/2 flex flex-col p-6">
                                <div className="mb-4">
                                    <label className="block text-xs uppercase text-white/50 mb-2 tracking-wider">Destination VM (Ingress)</label>
                                    <select 
                                        value={rightVm || ''} 
                                        onChange={(e) => setRightVm(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 text-white p-2 text-sm rounded outline-none focus:border-ruby/50"
                                    >
                                        <option value="" disabled>Select Destination...</option>
                                        <option value="host" className="text-ruby font-bold">Rangda (Host)</option>
                                        {vms.filter(v => v.status === 'running').map(v => (
                                            <option key={v.uuid} value={v.uuid}>{v.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex-1 overflow-y-auto border border-white/5 rounded p-2 bg-white/[0.02]">
                                    {rightFiles.length === 0 ? (
                                        <div className="text-white/30 text-xs text-center mt-10 uppercase tracking-widest">No accessible directories</div>
                                    ) : (
                                        rightFiles.map((f, i) => (
                                            <div 
                                                key={i}
                                                onDragOver={handleDragOver}
                                                onDrop={(e) => f.type === 'dir' ? handleDrop(e, f) : e.preventDefault()}
                                                className={`p-2 flex items-center gap-3 text-sm rounded transition-colors ${f.type === 'dir' ? 'border border-transparent hover:border-ruby/50 text-white/80' : 'text-white/50'}`}
                                            >
                                                <span>{f.type === 'dir' ? '📁' : '📄'}</span>
                                                <span className="font-mono">{f.name}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
