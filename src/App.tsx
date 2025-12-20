import { useState, useCallback, useRef, useEffect } from 'react'
import { FileBrowser } from './components/FileBrowser/FileBrowser'
import { VideoPlayer, VideoPlayerHandle } from './components/VideoPlayer/VideoPlayer'
import { Controls } from './components/Controls/Controls'
import { ExportDialog } from './components/Export/ExportDialog'
import { SettingsDialog } from './components/Settings/SettingsDialog'
import { KeyboardShortcutsModal } from './components/Help/KeyboardShortcutsModal'
import { WelcomeScreen } from './components/Onboarding/WelcomeScreen'
import { usePlayback } from './hooks/usePlayback'
import { useFileSystem } from './hooks/useFileSystem'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useSettings } from './hooks/useSettings'
import { useDragDrop } from './hooks/useDragDrop'
import type { VideoEvent, CameraAngle } from './types'

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const fileSystem = useFileSystem()
  const playback = usePlayback()
  const { settings, setSpeedUnit, setShowOverlay, setShowGMeter, setShowAccelChart, setShowPedalChart, setShowSpeedChart, setShowAccelDebug, setShowMap, setShowControls, setAutoHideControls, resetSettings } = useSettings()
  const [controlsVisible, setControlsVisible] = useState(true)
  const [isDraggingOverlay, setIsDraggingOverlay] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [thumbCamera, setThumbCamera] = useState<CameraAngle>('front')

  // Ref to VideoPlayer for seeking
  const videoPlayerRef = useRef<VideoPlayerHandle>(null)

  // Listen for '?' key to toggle help
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === '?' && !e.repeat && !e.target?.toString().includes('Input')) {
        setShowShortcuts(prev => !prev)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Handle time updates from primary video
  const handleTimeUpdate = useCallback((time: number) => {
    playback.setCurrentTime(time)
  }, [playback])

  // Handle duration change from primary video
  const handleDurationChange = useCallback((duration: number) => {
    playback.setDuration(duration)
  }, [playback])

  // Handle seek - sync all cameras
  const handleSeek = useCallback((time: number) => {
    playback.seek(time)
    videoPlayerRef.current?.seekAll(time)
  }, [playback])

  // Handle event selection from browser
  const handleEventSelect = useCallback((event: VideoEvent, clipIndex?: number) => {
    playback.loadEvent(event, clipIndex)
  }, [playback])

  const handleOpenFolder = useCallback(async (handle?: FileSystemDirectoryHandle) => {
    await fileSystem.openDirectory(handle)
  }, [fileSystem])

  // Handle play/pause
  const handlePlayPause = useCallback(() => {
    playback.togglePlayPause()
  }, [playback])

  // Handle jump with sync
  const handleJumpForward = useCallback(() => {
    const newTime = Math.min(playback.currentTime + 10, playback.duration)
    handleSeek(newTime)
  }, [playback.currentTime, playback.duration, handleSeek])

  const handleJumpBackward = useCallback(() => {
    const newTime = Math.max(playback.currentTime - 10, 0)
    handleSeek(newTime)
  }, [playback.currentTime, handleSeek])

  // Handle speed change
  const handleSpeedChange = useCallback((speed: number) => {
    playback.setPlaybackSpeed(speed)
  }, [playback])

  // Handle clip ended - auto advance
  const handleClipEnded = useCallback(() => {
    playback.onClipEnded()
  }, [playback])

  // Handle jump to event - need to sync the seek after clip change
  const handleJumpToEvent = useCallback(() => {
    if (playback.eventClipIndex !== undefined && playback.eventTimeOffset !== undefined) {
      const targetClipIndex = playback.eventClipIndex
      const targetTime = playback.eventTimeOffset

      if (targetClipIndex === playback.currentClipIndex) {
        // Same clip, just seek
        handleSeek(targetTime)
      } else {
        // Different clip - change clip and queue the seek
        playback.seekToClipAndTime(targetClipIndex, targetTime)
        // The seek will be applied when the clip loads via currentTime state
        // We need to apply it to the video player after a short delay
        setTimeout(() => {
          videoPlayerRef.current?.seekAll(targetTime)
        }, 100)
      }
    }
  }, [playback, handleSeek])

  // Handle next/prev event jumping
  const handleNextEvent = useCallback(() => {
    if (!playback.currentEvent || fileSystem.events.length === 0) return
    const currentIndex = fileSystem.events.findIndex(e => e.id === playback.currentEvent?.id)
    if (currentIndex < fileSystem.events.length - 1) {
      handleEventSelect(fileSystem.events[currentIndex + 1])
    }
  }, [playback.currentEvent, fileSystem.events, handleEventSelect])

  const handlePrevEvent = useCallback(() => {
    if (!playback.currentEvent || fileSystem.events.length === 0) return
    const currentIndex = fileSystem.events.findIndex(e => e.id === playback.currentEvent?.id)
    if (currentIndex > 0) {
      handleEventSelect(fileSystem.events[currentIndex - 1])
    }
  }, [playback.currentEvent, fileSystem.events, handleEventSelect])

  // Keyboard shortcuts
  useKeyboardShortcuts(playback, {
    onSeek: handleSeek,
    onJumpToEvent: handleJumpToEvent,
    onNextEvent: handleNextEvent,
    onPrevEvent: handlePrevEvent,
  })

  // Drag and drop support
  const { isDragging, dragHandlers } = useDragDrop({ onOpenFolder: handleOpenFolder })

  // Auto-hide controls logic - Triggered by bottom hover
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!settings.showControls || !settings.autoHideControls || isDraggingOverlay) return

    const container = mainRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const mouseY = e.clientY - rect.top
    const isAtBottom = mouseY > rect.height * 0.7 // Bottom 30%

    if (isAtBottom) {
      setControlsVisible(true)
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current)
        activityTimeoutRef.current = null
      }
    } else if (playback.isPlaying && controlsVisible) {
      // Hide after a short delay when leaving bottom area
      if (!activityTimeoutRef.current) {
        activityTimeoutRef.current = setTimeout(() => {
          setControlsVisible(false)
          activityTimeoutRef.current = null
        }, 1500)
      }
    }
  }, [settings.showControls, settings.autoHideControls, playback.isPlaying, controlsVisible])

  useEffect(() => {
    if (!settings.autoHideControls) {
      setControlsVisible(true)
      return
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current)
    }
  }, [settings.autoHideControls, handleMouseMove])

  // Handle controls visibility during playback changes
  useEffect(() => {
    if (!playback.isPlaying) {
      setControlsVisible(true)
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current)
        activityTimeoutRef.current = null
      }
    } else if (settings.autoHideControls && controlsVisible) {
      // If playing and controls are visible, ensure they hide eventually
      // even if the mouse doesn't move.
      if (!activityTimeoutRef.current) {
        activityTimeoutRef.current = setTimeout(() => {
          setControlsVisible(false)
          activityTimeoutRef.current = null
        }, 3000)
      }
    }
  }, [playback.isPlaying, settings.autoHideControls, controlsVisible])

  return (
    <div
      className="h-full flex flex-col bg-[#0a0a0a]"
      {...dragHandlers}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-[100] bg-tesla-red/20 backdrop-blur-md border-4 border-dashed border-tesla-red flex items-center justify-center pointer-events-none">
          <div className="bg-[#0f0f0f] p-12 rounded-3xl shadow-2xl text-center border border-white/10">
            <div className="w-24 h-24 bg-tesla-red rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl animate-bounce">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Drop to open folder</h2>
            <p className="text-gray-400">Release to scan your Tesla dashcam clips</p>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="flex-shrink-0 h-14 bg-black/40 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Toggle sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-3 pl-2 border-l border-white/10">
            <div className="group relative">
              <div className="absolute inset-0 bg-tesla-red/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <svg className="w-6 h-6 text-tesla-red relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold tracking-tight text-white/90">
              Argus
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {playback.currentClip && (
            <button
              onClick={() => setShowShortcuts(true)}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              title="Keyboard Shortcuts (?)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}

          <div className="w-px h-4 bg-white/10 mx-1" />

          <button
            onClick={() => setShowExportDialog(true)}
            disabled={!playback.currentClip}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="hidden sm:inline">Export</span>
          </button>

          <button
            onClick={() => setShowSettingsDialog(true)}
            className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-all"
            title="Settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          <div className="w-px h-4 bg-white/10 mx-1" />

          <button
            onClick={() => handleOpenFolder()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold bg-white text-black hover:scale-105 active:scale-95 transition-all shadow-[0_0_10px_rgba(255,255,255,0.1)]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
            </svg>
            <span className="hidden sm:inline">Open Folder</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0 relative">
        {!fileSystem.rootPath ? (
          <WelcomeScreen
            onOpenFolder={() => handleOpenFolder()}
            recentFolders={fileSystem.recentFolders}
            onOpenRecent={(handle) => handleOpenFolder(handle)}
          />
        ) : (
          <>
            {/* Sidebar */}
            {sidebarOpen && (
              <aside className="w-80 flex-shrink-0 border-r border-gray-800 overflow-hidden flex flex-col">
                <FileBrowser
                  events={fileSystem.events}
                  selectedEvent={playback.currentEvent}
                  selectedClipIndex={playback.currentClipIndex}
                  onSelectEvent={handleEventSelect}
                  isLoading={fileSystem.isLoading}
                  isScanning={fileSystem.isScanning}
                  rootPath={fileSystem.rootPath}
                  onOpenFolder={handleOpenFolder}
                  recentFolders={fileSystem.recentFolders}
                  onRemoveRecent={fileSystem.removeRecent}
                />
              </aside>
            )}

            {/* Video Area */}
            <main
              ref={mainRef}
              className="flex-1 flex flex-col min-w-0 min-h-0 relative group/video overflow-hidden"
            >
              <div
                className={`flex-1 min-h-0 p-3 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${controlsVisible && settings.showControls ? 'pb-[150px]' : 'pb-3'
                  }`}
              >
                <VideoPlayer
                  ref={videoPlayerRef}
                  clip={playback.currentClip}
                  clipIndex={playback.currentClipIndex}
                  totalClips={playback.currentEvent?.clips.length ?? 1}
                  isPlaying={playback.isPlaying}
                  playbackSpeed={playback.playbackSpeed}
                  visibleCameras={playback.visibleCameras}
                  onToggleCamera={playback.toggleCamera}
                  onTimeUpdate={handleTimeUpdate}
                  onDurationChange={handleDurationChange}
                  onClipEnded={handleClipEnded}
                  seiData={playback.currentSeiData}
                  speedUnit={settings.speedUnit}
                  overlayPosition={settings.overlayPosition}
                  showOverlay={settings.showOverlay}
                  showGMeter={settings.showGMeter}
                  showAccelChart={settings.showAccelChart}
                  showPedalChart={settings.showPedalChart}
                  showSpeedChart={settings.showSpeedChart}
                  showAccelDebug={settings.showAccelDebug}
                  showMap={settings.showMap}
                  currentTime={playback.currentTime}
                  onSetAllCamerasVisible={playback.setAllCamerasVisible}
                  onOverlayDragChange={setIsDraggingOverlay}
                />
              </div>

              {/* Controls - Floating & Collapsible */}
              {settings.showControls && (
                <div
                  className={`
                    absolute bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-5xl
                    transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]
                    ${controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12 pointer-events-none scale-95'}
                  `}
                  onMouseMove={(e) => e.stopPropagation()}
                >
                  <div className="bg-black/60 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
                    <Controls
                      isPlaying={playback.isPlaying}
                      currentTime={playback.currentTime}
                      duration={playback.duration}
                      clipIndex={playback.currentClipIndex}
                      totalClips={playback.currentEvent?.clips.length ?? 1}
                      eventClipIndex={playback.eventClipIndex}
                      eventTimeOffset={playback.eventTimeOffset}
                      onPlayPause={handlePlayPause}
                      onSeek={handleSeek}
                      onJumpForward={handleJumpForward}
                      onJumpBackward={handleJumpBackward}
                      onPrevClip={playback.prevClip}
                      onNextClip={playback.nextClip}
                      onSeekToClip={playback.seekToClip}
                      onJumpToEvent={handleJumpToEvent}
                      playbackSpeed={playback.playbackSpeed}
                      onSpeedChange={handleSpeedChange}
                      disabled={!playback.currentClip}
                      currentClip={playback.currentClip ?? undefined}
                      camera={thumbCamera}
                      onCameraChange={setThumbCamera}
                    />
                  </div>
                </div>
              )}

              {/* Minimal Progress Bar & Hover Hint (visible when controls hidden) */}
              <div
                className={`
                  absolute bottom-0 left-0 right-0 z-[90] transition-all duration-500
                  ${!controlsVisible && playback.currentClip && settings.showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}
                `}
              >
                {/* Hover Hint Text */}
                <div className="flex justify-center mb-2">
                  <div className="px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/5 text-[9px] font-bold text-white/30 tracking-[0.15em] uppercase pointer-events-none">
                    Hover for Controls
                  </div>
                </div>

                {/* Progress Line */}
                <div className="h-1 bg-white/5 w-full">
                  <div
                    className="h-full bg-tesla-red shadow-[0_0_8px_rgba(232,33,39,0.8)] transition-opacity duration-300"
                    style={{ width: `${playback.duration > 0 ? (playback.currentTime / playback.duration) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </main>
          </>
        )}
      </div>

      {/* Export Dialog */}
      {showExportDialog && playback.currentClip && (
        <ExportDialog
          clip={playback.currentClip}
          duration={playback.duration}
          currentTime={playback.currentTime}
          event={playback.currentEvent ?? undefined}
          totalTime={playback.totalTime}
          totalDuration={playback.totalDuration}
          clipDurations={playback.clipDurations}
          onClose={() => setShowExportDialog(false)}
        />
      )}

      {/* Settings Dialog */}
      {showSettingsDialog && (
        <SettingsDialog
          speedUnit={settings.speedUnit}
          showOverlay={settings.showOverlay}
          showGMeter={settings.showGMeter}
          showAccelChart={settings.showAccelChart}
          showPedalChart={settings.showPedalChart}
          showSpeedChart={settings.showSpeedChart}
          showAccelDebug={settings.showAccelDebug}
          onSpeedUnitChange={setSpeedUnit}
          onShowOverlayChange={setShowOverlay}
          onShowGMeterChange={setShowGMeter}
          onShowAccelChartChange={setShowAccelChart}
          onShowPedalChartChange={setShowPedalChart}
          onShowSpeedChartChange={setShowSpeedChart}
          onShowAccelDebugChange={setShowAccelDebug}
          showMap={settings.showMap}
          onShowMapChange={setShowMap}
          showControls={settings.showControls}
          onShowControlsChange={setShowControls}
          autoHideControls={settings.autoHideControls}
          onAutoHideControlsChange={setAutoHideControls}
          onReset={resetSettings}
          onClose={() => setShowSettingsDialog(false)}
        />
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}

      {/* Browser Compatibility Warning */}
      {!fileSystem.isSupported && (
        <div className="fixed bottom-4 right-4 max-w-sm bg-amber-900/90 border border-amber-700 rounded-lg p-4 shadow-xl">
          <div className="flex gap-3">
            <svg className="w-6 h-6 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="font-medium text-amber-200">Browser Not Supported</h3>
              <p className="text-sm text-amber-300/80 mt-1">
                This app requires the File System Access API. Please use Chrome, Edge, or another Chromium-based browser.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
