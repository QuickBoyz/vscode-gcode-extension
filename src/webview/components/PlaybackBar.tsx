import React, { useCallback, useEffect } from 'react';
import { usePlaybackSnapshot, usePlaybackActions } from '../context/PlaybackContext';
import { PlaybackStatus, SPEED_PRESETS } from '../playback/types';

interface PlaybackBarProps {
  readonly followSourceLine: boolean;
  readonly onFollowChange: (follow: boolean) => void;
}

/**
 * Wrapper that subscribes to the playback snapshot and conditionally
 * renders the PlaybackBar. This isolates the snapshot subscription
 * so CanvasArea never re-renders from playback state changes.
 */
export function PlaybackBarWrapper(props: PlaybackBarProps) {
  const { status } = usePlaybackSnapshot();
  if (status === PlaybackStatus.IDLE) return null;
  return <PlaybackBar {...props} />;
}

function PlaybackBar({ followSourceLine, onFollowChange }: PlaybackBarProps) {
  const { status, currentIndex, totalSegments, speedMultiplier } = usePlaybackSnapshot();
  const { play, pause, stop, exit, stepForward, stepBack, seekToSegment, setSpeed } =
    usePlaybackActions();

  const isPlaying = status === PlaybackStatus.PLAYING;

  // Keyboard shortcuts — active only during playback
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (isPlaying) pause();
          else play();
          break;
        case 'ArrowRight':
          e.preventDefault();
          stepForward();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          stepBack();
          break;
        case 'Escape':
          e.preventDefault();
          exit();
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isPlaying, play, pause, exit, stepForward, stepBack]);

  const handleScrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      seekToSegment(parseInt(e.target.value, 10));
    },
    [seekToSegment]
  );

  const handleSpeedChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSpeed(parseFloat(e.target.value));
    },
    [setSpeed]
  );

  return (
    <div className="playback-bar">
      <div className="playback-controls">
        <button className="playback-btn" title="Stop (Escape)" onClick={stop}>
          ■
        </button>
        <button className="playback-btn" title="Step back (←)" onClick={stepBack}>
          ◄
        </button>
        <button
          className="playback-btn playback-btn-primary"
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          onClick={isPlaying ? pause : play}
        >
          {isPlaying ? '❚❚' : '▶'}
        </button>
        <button className="playback-btn" title="Step forward (→)" onClick={stepForward}>
          ►
        </button>
        <select
          className="playback-speed"
          title="Playback speed"
          value={speedMultiplier}
          onChange={handleSpeedChange}
        >
          {SPEED_PRESETS.map((s) => (
            <option key={s} value={s}>
              {s}x
            </option>
          ))}
        </select>
        <button
          className={`playback-btn${followSourceLine ? ' active' : ''}`}
          title="Follow source line in editor"
          onClick={() => onFollowChange(!followSourceLine)}
        >
          Follow
        </button>
        <span className="playback-progress">
          {currentIndex + 1} / {totalSegments}
        </span>
      </div>
      <input
        className="playback-scrubber"
        type="range"
        min="0"
        max={Math.max(0, totalSegments - 1)}
        value={currentIndex}
        onChange={handleScrub}
        title={`Segment ${currentIndex + 1} of ${totalSegments}`}
      />
    </div>
  );
}
