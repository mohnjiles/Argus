import { useState, useCallback, useRef } from 'react'
import { FileBrowser } from './components/FileBrowser/FileBrowser'
import { VideoPlayer, VideoPlayerHandle } from './components/VideoPlayer/VideoPlayer'
import { Controls } from './components/Controls/Controls'
import { ExportDialog } from './components/Export/ExportDialog'
import { SettingsDialog } from './components/Settings/SettingsDialog'
import { usePlayback } from './hooks/usePlayback'
import { useFileSystem } from './hooks/useFileSystem'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useSettings } from './hooks/useSettings'
import type { VideoEvent } from './types'

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const fileSystem = useFileSystem()
  const playback = usePlayback()
  const { settings, setSpeedUnit, setOverlayPosition, setShowOverlay, setShowGMeter, setShowAccelChart, setShowPedalChart, setShowSpeedChart, setShowAccelDebug, resetSettings } = useSettings()
  
  // Ref to VideoPlayer for seeking
  const videoPlayerRef = useRef<VideoPlayerHandle>(null)
  
  // Keyboard shortcuts
  useKeyboardShortcuts(playback)

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

  const handleOpenFolder = useCallback(async () => {
    await fileSystem.openDirectory()
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

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* Header */}
      <header className="flex-shrink-0 h-14 px-4 flex items-center justify-between border-b border-gray-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
            title="Toggle sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-white flex items-center gap-2">
            <img src="/icon.png" alt="Argus" className="w-7 h-7" />
            Argus
          </h1>
        </div>
        
        <div className="flex items-center gap-2">
          {playback.currentClip && (
            <button
              onClick={() => setShowExportDialog(true)}
              className="btn btn-secondary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>
          )}
          <button
            onClick={() => setShowSettingsDialog(true)}
            className="btn btn-secondary flex items-center gap-2"
            title="Settings"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>
          <button
            onClick={handleOpenFolder}
            className="btn btn-primary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
            </svg>
            Open Folder
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="w-80 flex-shrink-0 border-r border-gray-800 overflow-hidden flex flex-col">
            <FileBrowser
              events={fileSystem.events}
              selectedEvent={playback.currentEvent}
              selectedClipIndex={playback.currentClipIndex}
              onSelectEvent={handleEventSelect}
              isLoading={fileSystem.isLoading}
              rootPath={fileSystem.rootPath}
            />
          </aside>
        )}

        {/* Video Area */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="flex-1 min-h-0 p-3">
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
              currentTime={playback.currentTime}
            />
          </div>
          
          {/* Controls */}
          <div className="flex-shrink-0 border-t border-gray-800">
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
            />
          </div>
        </main>
      </div>

      {/* Export Dialog */}
      {showExportDialog && playback.currentClip && (
        <ExportDialog
          clip={playback.currentClip}
          duration={playback.duration}
          currentTime={playback.currentTime}
          onClose={() => setShowExportDialog(false)}
        />
      )}

      {/* Settings Dialog */}
      {showSettingsDialog && (
        <SettingsDialog
          speedUnit={settings.speedUnit}
          overlayPosition={settings.overlayPosition}
          showOverlay={settings.showOverlay}
          showGMeter={settings.showGMeter}
          showAccelChart={settings.showAccelChart}
          showPedalChart={settings.showPedalChart}
          showSpeedChart={settings.showSpeedChart}
          showAccelDebug={settings.showAccelDebug}
          onSpeedUnitChange={setSpeedUnit}
          onOverlayPositionChange={setOverlayPosition}
          onShowOverlayChange={setShowOverlay}
          onShowGMeterChange={setShowGMeter}
          onShowAccelChartChange={setShowAccelChart}
          onShowPedalChartChange={setShowPedalChart}
          onShowSpeedChartChange={setShowSpeedChart}
          onShowAccelDebugChange={setShowAccelDebug}
          onReset={resetSettings}
          onClose={() => setShowSettingsDialog(false)}
        />
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
