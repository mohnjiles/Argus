/**
 * useSettings Hook
 * Manages application settings with localStorage persistence
 */

import { useState, useEffect, useCallback } from 'react';
import type { SpeedUnit } from '../types';

export type OverlayPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface Settings {
  speedUnit: SpeedUnit;
  overlayPosition: OverlayPosition;
  showOverlay: boolean;
  showGMeter: boolean;
  showAccelChart: boolean;
  showPedalChart: boolean;
  showSpeedChart: boolean;
  showAccelDebug: boolean;
  showMap: boolean;
  showControls: boolean;
  autoHideControls: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  speedUnit: 'mph',
  overlayPosition: 'bottom-left',
  showOverlay: true,
  showGMeter: true,
  showAccelChart: false,
  showPedalChart: false,
  showSpeedChart: false,
  showAccelDebug: false,
  showMap: true,
  showControls: true,
  autoHideControls: true,
};

const SETTINGS_KEY = 'argus-settings';

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
    return DEFAULT_SETTINGS;
  });

  // Save to localStorage whenever settings change
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }, [settings]);

  const setSpeedUnit = useCallback((unit: SpeedUnit) => {
    setSettings(prev => ({ ...prev, speedUnit: unit }));
  }, []);

  const setOverlayPosition = useCallback((position: OverlayPosition) => {
    setSettings(prev => ({ ...prev, overlayPosition: position }));
  }, []);

  const setShowOverlay = useCallback((show: boolean) => {
    setSettings(prev => ({ ...prev, showOverlay: show }));
  }, []);

  const setShowGMeter = useCallback((show: boolean) => {
    setSettings(prev => ({ ...prev, showGMeter: show }));
  }, []);

  const setShowAccelChart = useCallback((show: boolean) => {
    setSettings(prev => ({ ...prev, showAccelChart: show }));
  }, []);

  const setShowPedalChart = useCallback((show: boolean) => {
    setSettings(prev => ({ ...prev, showPedalChart: show }));
  }, []);

  const setShowSpeedChart = useCallback((show: boolean) => {
    setSettings(prev => ({ ...prev, showSpeedChart: show }));
  }, []);

  const setShowAccelDebug = useCallback((show: boolean) => {
    setSettings(prev => ({ ...prev, showAccelDebug: show }));
  }, []);

  const setShowMap = useCallback((show: boolean) => {
    setSettings(prev => ({ ...prev, showMap: show }));
  }, []);

  const setShowControls = useCallback((show: boolean) => {
    setSettings(prev => ({ ...prev, showControls: show }));
  }, []);

  const setAutoHideControls = useCallback((autoHide: boolean) => {
    setSettings(prev => ({ ...prev, autoHideControls: autoHide }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return {
    settings,
    setSpeedUnit,
    setOverlayPosition,
    setShowOverlay,
    setShowGMeter,
    setShowAccelChart,
    setShowPedalChart,
    setShowSpeedChart,
    setShowAccelDebug,
    setShowMap,
    setShowControls,
    setAutoHideControls,
    resetSettings,
  };
}

