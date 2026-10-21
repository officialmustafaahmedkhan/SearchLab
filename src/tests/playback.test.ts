import { describe, it, expect } from 'vitest';
import { PlaybackController } from '../engine/playback';
import { ExecutionEvent } from '../types/execution';

describe('SearchLab Playback Controller Tests', () => {
  const dummyEvents: ExecutionEvent[] = [
    {
      id: 0,
      type: 'NODE_SELECTED',
      timestamp: 10,
      description: 'Selected A',
      line: 5,
      stateSnapshot: {
        dataStructure: {},
        variables: { step: 0 },
        metrics: { comparisons: 0, swaps: 0, writes: 0, nodesVisited: 1, edgesTraversed: 0, timeElapsedMs: 10 },
        consoleLogs: [],
      },
    },
    {
      id: 1,
      type: 'NODE_EXPANDED',
      timestamp: 20,
      description: 'Expanded A',
      line: 8,
      stateSnapshot: {
        dataStructure: {},
        variables: { step: 1 },
        metrics: { comparisons: 0, swaps: 0, writes: 0, nodesVisited: 1, edgesTraversed: 0, timeElapsedMs: 20 },
        consoleLogs: [],
      },
    },
    {
      id: 2,
      type: 'GOAL_FOUND',
      timestamp: 30,
      description: 'Goal reached',
      line: 12,
      stateSnapshot: {
        dataStructure: {},
        variables: { step: 2 },
        metrics: { comparisons: 0, swaps: 0, writes: 0, nodesVisited: 2, edgesTraversed: 1, timeElapsedMs: 30 },
        consoleLogs: [],
      },
    },
  ];

  it('should initialize with first event at step 0', () => {
    const controller = new PlaybackController(dummyEvents);
    const state = controller.getState();
    expect(state.currentStepIndex).toBe(0);
    expect(state.totalSteps).toBe(3);
    expect(state.currentEvent?.id).toBe(0);
  });

  it('should step forward and step backward accurately restoring historical state', () => {
    const controller = new PlaybackController(dummyEvents);

    // Step Forward to step 1
    const moved1 = controller.stepForward();
    expect(moved1).toBe(true);
    expect(controller.getState().currentStepIndex).toBe(1);
    expect(controller.getState().currentSnapshot?.variables.step).toBe(1);

    // Step Forward to step 2
    const moved2 = controller.stepForward();
    expect(moved2).toBe(true);
    expect(controller.getState().currentStepIndex).toBe(2);
    expect(controller.getState().currentSnapshot?.variables.step).toBe(2);

    // Stepping past end returns false
    const movedEnd = controller.stepForward();
    expect(movedEnd).toBe(false);

    // Step Backward back to step 1
    const back1 = controller.stepBackward();
    expect(back1).toBe(true);
    expect(controller.getState().currentStepIndex).toBe(1);
    expect(controller.getState().currentSnapshot?.variables.step).toBe(1);

    // Step Backward back to step 0
    const back0 = controller.stepBackward();
    expect(back0).toBe(true);
    expect(controller.getState().currentStepIndex).toBe(0);
    expect(controller.getState().currentSnapshot?.variables.step).toBe(0);

    // Cannot step back before 0
    expect(controller.stepBackward()).toBe(false);
  });

  it('should jump to arbitrary step indices deterministically', () => {
    const controller = new PlaybackController(dummyEvents);
    controller.jumpToStep(2);
    expect(controller.getState().currentStepIndex).toBe(2);
    expect(controller.getState().currentEvent?.description).toBe('Goal reached');

    controller.jumpToStep(0);
    expect(controller.getState().currentStepIndex).toBe(0);
  });

  it('should reset to step 0', () => {
    const controller = new PlaybackController(dummyEvents);
    controller.jumpToStep(2);
    controller.reset();
    expect(controller.getState().currentStepIndex).toBe(0);
  });

  it('should clamp playback speed within valid bounds', () => {
    const controller = new PlaybackController(dummyEvents);
    controller.setSpeed(5); // below 15ms minimum
    expect(controller.getState().speedMs).toBe(15);

    controller.setSpeed(5000); // above 3000ms max
    expect(controller.getState().speedMs).toBe(3000);

    controller.setSpeed(450);
    expect(controller.getState().speedMs).toBe(450);
  });
});
