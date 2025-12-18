/**
 * useFileSystem Hook
 * Manages file system state and directory scanning
 */

import { useState, useCallback } from 'react';
import type { FileSystemState } from '../types';
import {
  openDirectoryPicker,
  scanDirectory,
  isFileSystemAccessSupported
} from '../lib/file-scanner';

export function useFileSystem() {
  const [state, setState] = useState<FileSystemState>({
    rootHandle: null,
    rootPath: '',
    events: [],
    isLoading: false,
    error: null,
  });

  const openDirectory = useCallback(async () => {
    if (!isFileSystemAccessSupported()) {
      setState(prev => ({
        ...prev,
        error: 'File System Access API not supported. Please use Chrome or Edge.',
      }));
      return;
    }

    try {
      const handle = await openDirectoryPicker();
      if (!handle) return; // User cancelled

      setState(prev => ({
        ...prev,
        rootHandle: handle,
        rootPath: handle.name,
        isLoading: true,
        error: null,
      }));

      const events = await scanDirectory(handle, (message) => {
        console.log('Scan progress:', message);
      });

      setState(prev => ({
        ...prev,
        events,
        isLoading: false,
      }));
    } catch (e) {
      console.error('Failed to open directory:', e);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: (e as Error).message,
      }));
    }
  }, []);

  const refreshDirectory = useCallback(async () => {
    if (!state.rootHandle) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const events = await scanDirectory(state.rootHandle);
      setState(prev => ({ ...prev, events, isLoading: false }));
    } catch (e) {
      console.error('Failed to refresh directory:', e);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: (e as Error).message,
      }));
    }
  }, [state.rootHandle]);

  const clearDirectory = useCallback(() => {
    setState({
      rootHandle: null,
      rootPath: '',
      events: [],
      isLoading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    openDirectory,
    refreshDirectory,
    clearDirectory,
    isSupported: isFileSystemAccessSupported(),
  };
}
