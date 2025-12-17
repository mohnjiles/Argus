/**
 * useKeyboardShortcuts Hook
 * Handles global keyboard shortcuts for playback control
 */

import { useEffect, useRef } from 'react';
import type { PlaybackController } from './usePlayback';

export function useKeyboardShortcuts(playback: PlaybackController) {
  const playbackRef = useRef(playback);

  // Keep a stable ref so we don't re-register listeners on every render.
  useEffect(() => {
    playbackRef.current = playback;
  }, [playback]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const pb = playbackRef.current;

      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          pb.togglePlayPause();
          break;
        case 'k':
          e.preventDefault();
          pb.togglePlayPause();
          break;
        case 'j':
          e.preventDefault();
          pb.seek(Math.max(pb.currentTime - 10, 0));
          break;
        case 'l':
          e.preventDefault();
          pb.seek(Math.min(pb.currentTime + 10, pb.duration));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) {
            pb.seek(Math.max(pb.currentTime - 5, 0));
          } else {
            pb.seek(Math.max(pb.currentTime - 1, 0));
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) {
            pb.seek(Math.min(pb.currentTime + 5, pb.duration));
          } else {
            pb.seek(Math.min(pb.currentTime + 1, pb.duration));
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          pb.setPlaybackSpeed(Math.min(pb.playbackSpeed + 0.25, 2));
          break;
        case 'ArrowDown':
          e.preventDefault();
          pb.setPlaybackSpeed(Math.max(pb.playbackSpeed - 0.25, 0.25));
          break;
        case 'Home':
          e.preventDefault();
          pb.seek(0);
          break;
        case 'End':
          e.preventDefault();
          pb.seek(pb.duration);
          break;
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          e.preventDefault();
          const fraction = parseInt(e.key) / 10;
          pb.seek(pb.duration * fraction);
          break;
        case 'n':
        case 'N':
          e.preventDefault();
          pb.nextClip();
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          pb.prevClip();
          break;
        case 'e':
        case 'E':
          e.preventDefault();
          pb.jumpToEvent();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}

