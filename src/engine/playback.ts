import { ExecutionEvent, StateSnapshot } from '../types/execution';

export interface PlaybackState {
  currentStepIndex: number;
  totalSteps: number;
  isPlaying: boolean;
  speedMs: number; // delay between steps in ms
  currentEvent: ExecutionEvent | null;
  currentSnapshot: StateSnapshot | null;
}

export type PlaybackListener = (state: PlaybackState) => void;

export class PlaybackController {
  private events: ExecutionEvent[] = [];
  private currentStepIndex = -1;
  private isPlaying = false;
  private speedMs = 300; // default 300ms
  private timer: any = null;
  private listeners: Set<PlaybackListener> = new Set();

  constructor(events: ExecutionEvent[] = []) {
    this.setEvents(events);
  }

  public setEvents(events: ExecutionEvent[]) {
    this.pause();
    this.events = events;
    this.currentStepIndex = events.length > 0 ? 0 : -1;
    this.notify();
  }

  public subscribe(listener: PlaybackListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }

  public getState(): PlaybackState {
    const currentEvent =
      this.currentStepIndex >= 0 && this.currentStepIndex < this.events.length
        ? this.events[this.currentStepIndex]
        : null;

    return {
      currentStepIndex: this.currentStepIndex,
      totalSteps: this.events.length,
      isPlaying: this.isPlaying,
      speedMs: this.speedMs,
      currentEvent,
      currentSnapshot: currentEvent ? currentEvent.stateSnapshot : null,
    };
  }

  public setSpeed(speedMs: number) {
    this.speedMs = Math.max(15, Math.min(3000, speedMs));
    if (this.isPlaying) {
      this.pause();
      this.play();
    } else {
      this.notify();
    }
  }

  public stepForward(): boolean {
    if (this.currentStepIndex < this.events.length - 1) {
      this.currentStepIndex++;
      this.notify();
      return true;
    }
    this.pause();
    return false;
  }

  public stepBackward(): boolean {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      this.notify();
      return true;
    }
    return false;
  }

  public jumpToStep(index: number) {
    if (this.events.length === 0) return;
    const clamped = Math.max(0, Math.min(this.events.length - 1, index));
    this.currentStepIndex = clamped;
    this.notify();
  }

  public play() {
    if (this.events.length === 0) return;
    if (this.currentStepIndex >= this.events.length - 1) {
      this.currentStepIndex = 0;
    }
    this.isPlaying = true;
    this.notify();

    const loop = () => {
      if (!this.isPlaying) return;
      const moved = this.stepForward();
      if (moved && this.isPlaying) {
        this.timer = setTimeout(loop, this.speedMs);
      } else {
        this.pause();
      }
    };

    this.timer = setTimeout(loop, this.speedMs);
  }

  public pause() {
    this.isPlaying = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.notify();
  }

  public reset() {
    this.pause();
    if (this.events.length > 0) {
      this.currentStepIndex = 0;
    } else {
      this.currentStepIndex = -1;
    }
    this.notify();
  }

  public jumpToEnd() {
    this.pause();
    if (this.events.length > 0) {
      this.currentStepIndex = this.events.length - 1;
    }
    this.notify();
  }
}
