import { useRef, useEffect } from 'react';

interface KeyboardShortcutsModalProps {
    onClose: () => void;
}

export function KeyboardShortcutsModal({ onClose }: KeyboardShortcutsModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Close on escape
    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') onClose();
        }
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div
                ref={modalRef}
                className="bg-[#0f0f0f] border border-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
                <div className="p-4 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-[#0f0f0f] z-10">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                        </svg>
                        Keyboard Shortcuts
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-white rounded hover:bg-white/10 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        <ShortcutGroup title="Playback">
                            <ShortcutItem keys={['Space', 'K']} description="Play / Pause" />
                            <ShortcutItem keys={['J', 'L']} description="Jump -/+ 10 seconds" />
                            <ShortcutItem keys={['↑', '↓']} description="Adjust playback speed" />
                        </ShortcutGroup>

                        <ShortcutGroup title="Seeking">
                            <ShortcutItem keys={['←', '→']} description="Seek -/+ 1 second" />
                            <ShortcutItem keys={['Shift', '←', '→']} description="Seek -/+ 5 seconds" />
                            <ShortcutItem keys={[',', '.']} description="Frame step -/+" />
                            <ShortcutItem keys={['0-9']} description="Jump to 0-90%" />
                            <ShortcutItem keys={['Home', 'End']} description="Jump to Start / End" />
                        </ShortcutGroup>

                        <ShortcutGroup title="Event Navigation">
                            <ShortcutItem keys={['E']} description="Jump to Event Marker" />
                            <ShortcutItem keys={['P']} description="Previous Clip" />
                            <ShortcutItem keys={['N']} description="Next Clip" />
                            <ShortcutItem keys={['[']} description="Previous Event" />
                            <ShortcutItem keys={[']']} description="Next Event" />
                        </ShortcutGroup>

                        <ShortcutGroup title="Interface">
                            <ShortcutItem keys={['?']} description="Toggle help menu" />
                            <ShortcutItem keys={['Drag folder']} description="Open TeslaCam folder" />
                            <ShortcutItem keys={['Double Click']} description="Toggle Fullscreen" />
                        </ShortcutGroup>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-800 bg-[#0a0a0a] text-center text-xs text-gray-500">
                    Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-gray-300 font-mono">?</kbd> to toggle this help menu
                </div>
            </div>
        </div>
    );
}

function ShortcutGroup({ title, children }: { title: string, children: React.ReactNode }) {
    return (
        <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</h3>
            <div className="space-y-2">
                {children}
            </div>
        </div>
    );
}

function ShortcutItem({ keys, description }: { keys: string[], description: string }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">{description}</span>
            <div className="flex items-center gap-1.5">
                {keys.map((key, i) => (
                    <kbd
                        key={i}
                        className={`
              min-w-[24px] h-6 px-1.5 flex items-center justify-center 
              bg-[#2a2a2a] border border-gray-700 rounded 
              text-xs font-mono text-gray-300 shadow-sm
              ${key.length > 1 ? 'text-[10px]' : ''}
            `}
                    >
                        {key}
                    </kbd>
                ))}
            </div>
        </div>
    );
}
