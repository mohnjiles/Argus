/**
 * useKeyboardShortcuts Hook
 * Handles global keyboard shortcuts for playback control
 */

import { useEffect, useRef } from 'react';
import type { PlaybackController } from './usePlayback';

export interface KeyboardShortcutOptions {
  onSeek?: (time: number) => void;
  onJumpToEvent?: () => void;
  onNextEvent?: () => void;
  onPrevEvent?: () => void;
}

export function useKeyboardShortcuts(playback: PlaybackController, options?: KeyboardShortcutOptions) {
  const playbackRef = useRef(playback);
  const optionsRef = useRef(options);

  // Keep stable refs so we don't re-register listeners on every render.
  useEffect(() => {
    playbackRef.current = playback;
  }, [playback]);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const pb = playbackRef.current;
      const opts = optionsRef.current;

      // Ignore if user is typing in a text-entry field
      const isTextEntry =
        (e.target instanceof HTMLInputElement && ['text', 'number', 'email', 'password', 'search', 'tel', 'url'].includes(e.target.type)) ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement;

      if (isTextEntry) {
        return;
      }

      const seek = opts?.onSeek || pb.seek;

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
          seek(Math.max(pb.currentTime - 10, 0));
          break;
        case 'l':
          e.preventDefault();
          seek(Math.min(pb.currentTime + 10, pb.duration));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) {
            seek(Math.max(pb.currentTime - 5, 0));
          } else {
            seek(Math.max(pb.currentTime - 1, 0));
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) {
            seek(Math.min(pb.currentTime + 5, pb.duration));
          } else {
            seek(Math.min(pb.currentTime + 1, pb.duration));
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
          seek(0);
          break;
        case 'End':
          e.preventDefault();
          seek(pb.duration);
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
          seek(pb.duration * fraction);
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
        case '[':
          e.preventDefault();
          opts?.onPrevEvent?.();
          break;
        case ']':
          e.preventDefault();
          opts?.onNextEvent?.();
          break;
        case 'e':
        case 'E':
          e.preventDefault();
          if (opts?.onJumpToEvent) {
            opts.onJumpToEvent();
          } else {
            pb.jumpToEvent();
          }
          break;
        case ',':
        case '<':
          e.preventDefault();
          if (pb.stepFrame) {
            pb.stepFrame(-1);
          } else {
            // Fallback for older interface
            seek(Math.max(pb.currentTime - 0.033, 0));
          }
          break;
        case '.':
        case '>':
          e.preventDefault();
          if (pb.stepFrame) {
            pb.stepFrame(1);
          } else {
            // Fallback
            seek(Math.min(pb.currentTime + 0.033, pb.duration));
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}

