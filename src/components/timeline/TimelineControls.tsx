import React from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, FastForward, Activity } from 'lucide-react';
import { PlaybackState } from '../../engine/playback';

interface TimelineControlsProps {
  playbackState: PlaybackState;
  onPlay: () => void;
  onPause: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onJumpToStep: (step: number) => void;
  onReset: () => void;
  onJumpToEnd: () => void;
  onSpeedChange: (speedMs: number) => void;
}

export const TimelineControls: React.FC<TimelineControlsProps> = ({
  playbackState,
  onPlay,
  onPause,
  onStepForward,
  onStepBackward,
  onJumpToStep,
  onReset,
  onJumpToEnd,
  onSpeedChange,
}) => {
  const { currentStepIndex, totalSteps, isPlaying, speedMs, currentEvent } = playbackState;

  // Convert speedMs to speed label
  const getSpeedLabel = (ms: number) => {
    if (ms <= 60) return '5.0x';
    if (ms <= 150) return '2.0x';
    if (ms <= 300) return '1.0x';
    if (ms <= 600) return '0.5x';
    return '0.2x';
  };

  return (
    <div className="timeline-controls-bar">
      {/* Playback Buttons Group */}
      <div className="playback-btn-group">
        <button
          className="timeline-btn"
          onClick={onReset}
          disabled={totalSteps === 0 || currentStepIndex <= 0}
          title="Reset to Beginning"
        >
          <RotateCcw size={15} />
        </button>

        <button
          className="timeline-btn"
          onClick={onStepBackward}
          disabled={totalSteps === 0 || currentStepIndex <= 0}
          title="Previous Step (Left Arrow)"
        >
          <SkipBack size={15} />
        </button>

        {isPlaying ? (
          <button
            className="timeline-btn timeline-btn-play is-active"
            onClick={onPause}
            title="Pause Execution (Space)"
          >
            <Pause size={17} fill="currentColor" />
          </button>
        ) : (
          <button
            className="timeline-btn timeline-btn-play"
            onClick={onPlay}
            disabled={totalSteps === 0}
            title="Play / Continue (Space)"
          >
            <Play size={17} fill="currentColor" />
          </button>
        )}

        <button
          className="timeline-btn"
          onClick={onStepForward}
          disabled={totalSteps === 0 || currentStepIndex >= totalSteps - 1}
          title="Next Step (Right Arrow)"
        >
          <SkipForward size={15} />
        </button>

        <button
          className="timeline-btn"
          onClick={onJumpToEnd}
          disabled={totalSteps === 0 || currentStepIndex >= totalSteps - 1}
          title="Jump to Final State"
        >
          <FastForward size={15} />
        </button>
      </div>

      {/* Step Scrubber Slider */}
      <div className="timeline-scrubber-section">
        <span className="step-counter">
          Step <strong>{currentStepIndex >= 0 ? currentStepIndex + 1 : 0}</strong> / {totalSteps}
        </span>
        <input
          type="range"
          className="timeline-slider"
          min={0}
          max={Math.max(0, totalSteps - 1)}
          value={currentStepIndex >= 0 ? currentStepIndex : 0}
          disabled={totalSteps === 0}
          onChange={(e) => onJumpToStep(Number(e.target.value))}
        />
      </div>

      {/* Speed Slider */}
      <div className="timeline-speed-section">
        <span className="speed-label">Speed: {getSpeedLabel(speedMs)}</span>
        <input
          type="range"
          className="speed-slider"
          min={30}
          max={1000}
          step={20}
          // inverted because higher ms = slower
          value={1030 - speedMs}
          onChange={(e) => onSpeedChange(1030 - Number(e.target.value))}
        />
      </div>

      {/* Current Step Description Event Banner */}
      {currentEvent && (
        <div className="timeline-event-badge">
          <Activity size={14} className="text-cyan animate-pulse" />
          <span className="event-type-tag">[{currentEvent.type}]</span>
          <span className="event-desc">{currentEvent.description}</span>
        </div>
      )}
    </div>
  );
};
