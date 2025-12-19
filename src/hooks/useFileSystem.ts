import { useState, useCallback, useEffect } from 'react';
import type { FileSystemState } from '../types';
import {
  openDirectoryPicker,
  scanDirectory,
  isFileSystemAccessSupported
} from '../lib/file-scanner';
import { saveRecentFolder, getRecentFolders, removeRecentFolder as removeRecentStored, RecentFolder } from '../lib/recent-folders';

export interface ExtendedFileSystemState extends FileSystemState {
  recentFolders: RecentFolder[];
}

export function useFileSystem() {
  const [state, setState] = useState<ExtendedFileSystemState>({
    rootHandle: null,
    rootPath: '',
    events: [],
    isLoading: false,
    isScanning: false,
    error: null,
    recentFolders: [],
  });

  // Load recent folders on mount
  useEffect(() => {
    getRecentFolders().then(recent => {
      setState(prev => ({ ...prev, recentFolders: recent }));
    });
  }, []);

  const openDirectory = useCallback(async (existingHandle?: FileSystemDirectoryHandle) => {
    if (!isFileSystemAccessSupported()) {
      setState(prev => ({
        ...prev,
        error: 'File System Access API not supported. Please use Chrome or Edge.',
      }));
      return;
    }

    try {
      const handle = existingHandle || await openDirectoryPicker();
      if (!handle) return; // User cancelled

      setState(prev => ({
        ...prev,
        rootHandle: handle,
        rootPath: handle.name,
        isLoading: true,
        isScanning: true,
        error: null,
      }));

      // Save to recents
      await saveRecentFolder(handle);
      const recent = await getRecentFolders();

      const events = await scanDirectory(handle, (message) => {
        console.log('Scan progress:', message);
      }, (incrementalEvents) => {
        setState(prev => ({
          ...prev,
          events: incrementalEvents,
          isLoading: false, // Once we have some events, we can show them
          recentFolders: recent,
        }));
      });

      setState(prev => ({
        ...prev,
        events,
        isLoading: false,
        isScanning: false,
        recentFolders: recent,
      }));
    } catch (e) {
      console.error('Failed to open directory:', e);
      setState(prev => ({
        ...prev,
        isLoading: false,
        isScanning: false,
        error: (e as Error).message,
      }));
    }
  }, []);

  const refreshDirectory = useCallback(async () => {
    if (!state.rootHandle) return;

    setState(prev => ({ ...prev, isLoading: true, isScanning: true, error: null }));

    try {
      const events = await scanDirectory(state.rootHandle, undefined, (incrementalEvents) => {
        setState(prev => ({ ...prev, events: incrementalEvents, isLoading: false }));
      });
      setState(prev => ({ ...prev, events, isLoading: false, isScanning: false }));
    } catch (e) {
      console.error('Failed to refresh directory:', e);
      setState(prev => ({
        ...prev,
        isLoading: false,
        isScanning: false,
        error: (e as Error).message,
      }));
    }
  }, [state.rootHandle]);

  const removeRecent = useCallback(async (path: string) => {
    await removeRecentStored(path);
    const recent = await getRecentFolders();
    setState(prev => ({ ...prev, recentFolders: recent }));
  }, []);

  const clearDirectory = useCallback(() => {
    setState(prev => ({
      ...prev,
      rootHandle: null,
      rootPath: '',
      events: [],
      isLoading: false,
      isScanning: false,
      error: null,
    }));
  }, []);

  return {
    ...state,
    openDirectory,
    refreshDirectory,
    clearDirectory,
    removeRecent,
    isSupported: isFileSystemAccessSupported(),
  };
}
