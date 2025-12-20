/**
 * SettingsDialog Component
 * Allows users to configure app preferences
 */

import type { SpeedUnit } from '../../types';

interface SettingsDialogProps {
  speedUnit: SpeedUnit;
  showOverlay: boolean;
  showGMeter: boolean;
  showAccelChart: boolean;
  showPedalChart: boolean;
  showSpeedChart: boolean;
  showAccelDebug: boolean;
  onSpeedUnitChange: (unit: SpeedUnit) => void;
  onShowOverlayChange: (show: boolean) => void;
  onShowGMeterChange: (show: boolean) => void;
  onShowAccelChartChange: (show: boolean) => void;
  onShowPedalChartChange: (show: boolean) => void;
  onShowSpeedChartChange: (show: boolean) => void;
  onShowAccelDebugChange: (show: boolean) => void;
  onReset: () => void;
  onClose: () => void;
}

export function SettingsDialog({
  speedUnit,
  showOverlay,
  showGMeter,
  showAccelChart,
  showPedalChart,
  showSpeedChart,
  showAccelDebug,
  onSpeedUnitChange,
  onShowOverlayChange,
  onShowGMeterChange,
  onShowAccelChartChange,
  onShowPedalChartChange,
  onShowSpeedChartChange,
  onShowAccelDebugChange,
  onReset,
  onClose,
}: SettingsDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-[#121212]/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <h2 className="text-xl font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
            title="Close"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Speed Unit */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Speed Unit
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => onSpeedUnitChange('mph')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${speedUnit === 'mph'
                  ? 'bg-tesla-red text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
              >
                MPH
              </button>
              <button
                onClick={() => onSpeedUnitChange('kph')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${speedUnit === 'kph'
                  ? 'bg-tesla-red text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
              >
                KPH
              </button>
            </div>
          </div>

          {/* Show Overlay */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <label className="flex items-center justify-between cursor-pointer group">
              <span className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">Show Telemetry Overlay</span>
              <button
                onClick={() => onShowOverlayChange(!showOverlay)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 ${showOverlay ? 'bg-tesla-red shadow-[0_0_15px_rgba(232,33,39,0.4)]' : 'bg-gray-700'
                  }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${showOverlay ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
              </button>
            </label>
          </div>



          {/* G-Force Overlays Section */}
          {showOverlay && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-300">
                G-Force Displays
              </label>

              {/* G-Meter Toggle */}
              <div className="pl-2 border-l-2 border-gray-700 space-y-3">
                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-300">G-Meter</span>
                    <p className="text-xs text-gray-500">Circular visualization of lateral/longitudinal G-forces</p>
                  </div>
                  <button
                    onClick={() => onShowGMeterChange(!showGMeter)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showGMeter ? 'bg-tesla-red' : 'bg-gray-700'
                      }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showGMeter ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                  </button>
                </label>

                {/* Acceleration Chart Toggle */}
                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-300">Acceleration Chart</span>
                    <p className="text-xs text-gray-500">Time-series graph of G-forces (last 10 seconds)</p>
                  </div>
                  <button
                    onClick={() => onShowAccelChartChange(!showAccelChart)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showAccelChart ? 'bg-tesla-red' : 'bg-gray-700'
                      }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showAccelChart ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                  </button>
                </label>

                {/* Pedal Chart Toggle */}
                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-300">Pedal Input Chart</span>
                    <p className="text-xs text-gray-500">Throttle and brake pedal positions over time</p>
                  </div>
                  <button
                    onClick={() => onShowPedalChartChange(!showPedalChart)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showPedalChart ? 'bg-tesla-red' : 'bg-gray-700'
                      }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showPedalChart ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                  </button>
                </label>

                {/* Speed Chart Toggle */}
                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-300">Speed Chart</span>
                    <p className="text-xs text-gray-500">Vehicle speed over time with gradient fill</p>
                  </div>
                  <button
                    onClick={() => onShowSpeedChartChange(!showSpeedChart)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showSpeedChart ? 'bg-tesla-red' : 'bg-gray-700'
                      }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showSpeedChart ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                  </button>
                </label>

                {/* Debug Overlay Toggle */}
                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-300">Debug Values</span>
                    <p className="text-xs text-gray-500">Raw acceleration values for all axes</p>
                  </div>
                  <button
                    onClick={() => onShowAccelDebugChange(!showAccelDebug)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showAccelDebug ? 'bg-tesla-red' : 'bg-gray-700'
                      }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showAccelDebug ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                  </button>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/5 bg-white/[0.02]">
          <button
            onClick={onReset}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            Reset to Defaults
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg text-sm font-bold bg-white text-black hover:scale-105 active:scale-95 transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

