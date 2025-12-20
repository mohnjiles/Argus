import { useState } from 'react';
import { RecentFolder, verifyPermission } from '../../lib/recent-folders';

interface WelcomeScreenProps {
    onOpenFolder: () => void;
    recentFolders: RecentFolder[];
    onOpenRecent: (handle: FileSystemDirectoryHandle) => void;
}

export function WelcomeScreen({ onOpenFolder, recentFolders, onOpenRecent }: WelcomeScreenProps) {
    const [isHovering, setIsHovering] = useState(false);

    const handleRecentClick = async (folder: RecentFolder) => {
        try {
            const granted = await verifyPermission(folder.handle);
            if (granted) {
                onOpenRecent(folder.handle);
            }
        } catch (e) {
            console.error('Failed to open recent folder:', e);
        }
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#0a0a0a] relative overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-tesla-red/5 rounded-full blur-[120px]" />
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-500/5 rounded-full blur-[150px] -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-purple-500/5 rounded-full blur-[150px] translate-y-1/2 -translate-x-1/2" />
            </div>

            <div className="relative z-10 flex flex-col items-center max-w-2xl w-full px-6">
                {/* Logo / Icon */}
                <div
                    className="relative group mb-8 cursor-pointer"
                    onMouseEnter={() => setIsHovering(true)}
                    onMouseLeave={() => setIsHovering(false)}
                    onClick={onOpenFolder}
                >
                    {/* Pulse Rings */}
                    <div className="absolute inset-0 rounded-3xl bg-tesla-red opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500 scale-150" />
                    <div className="absolute inset-0 rounded-3xl bg-tesla-red opacity-0 group-hover:opacity-10 blur-2xl transition-opacity duration-700 scale-125 animate-pulse" />

                    <div className="w-24 h-24 bg-[#1a1a1a] rounded-3xl border border-white/10 shadow-2xl flex items-center justify-center relative backdrop-blur-sm group-hover:scale-105 transition-transform duration-300 group-hover:border-tesla-red/30">
                        <svg
                            className={`w-12 h-12 text-white/80 transition-all duration-300 ${isHovering ? 'scale-110 text-tesla-red drop-shadow-[0_0_15px_rgba(232,33,39,0.5)]' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>

                        {/* Play Button Icon Overlay */}
                        <div className={`absolute bottom-6 right-6 w-8 h-8 bg-tesla-red rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${isHovering ? 'scale-110 opacity-100' : 'scale-90 opacity-0'}`}>
                            <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Text Content */}
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 text-center tracking-tight">
                    Argus
                </h1>
                <p className="text-base text-gray-400 text-center max-w-lg mb-8">
                    Advanced viewer for Tesla Dashcam and Sentry Mode clips.
                    View all camera angles synced with telemetry data.
                </p>

                {/* Main CTA */}
                <button
                    onClick={onOpenFolder}
                    className="group relative px-6 py-3 bg-white text-black rounded-full font-bold text-lg shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] hover:scale-105 transition-all duration-300 active:scale-95 mb-10 flex items-center gap-3"
                >
                    {/* Ping effect */}
                    <span className="absolute -inset-1 rounded-full bg-white/30 animate-pulse blur-sm group-hover:animate-none transition-all" />

                    <span className="relative z-10">Open TeslaCam Folder</span>
                    <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-100 blur-lg transition-opacity duration-300 -z-10" />
                </button>

                {/* Recent Folders */}
                {recentFolders.length > 0 && (
                    <div className="w-full max-w-md animate-fade-in-up">
                        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-[0.2em] mb-4 text-center">Recent Folders</h2>
                        <div className="grid gap-3">
                            {recentFolders.slice(0, 3).map((folder) => (
                                <button
                                    key={folder.path}
                                    onClick={() => handleRecentClick(folder)}
                                    className="group flex items-center p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all text-left"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-[#222] flex items-center justify-center mr-3 group-hover:bg-tesla-red/20 transition-colors">
                                        <svg className="w-4 h-4 text-gray-400 group-hover:text-tesla-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-white truncate group-hover:text-tesla-red transition-colors">
                                            {folder.path.split('/').pop() || folder.path}
                                        </div>
                                        <div className="text-xs text-gray-500 truncate mt-0.5">
                                            {folder.path}
                                        </div>
                                    </div>
                                    <div className="text-xs text-gray-600 group-hover:text-gray-400 ml-4 whitespace-nowrap">
                                        {new Date(folder.lastOpened).toLocaleDateString()}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Footer Hint */}
                <div className="mt-10 text-xs text-gray-600 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="opacity-70">You can also drag and drop folder here</span>
                </div>
            </div>
        </div>
    );
}
