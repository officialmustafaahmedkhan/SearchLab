import { describe, it, expect } from 'vitest';
import { pythonExecutor, javaExecutor } from '../engine/executor';
import { ALGORITHM_CATALOG } from '../algorithms/catalog';
import { romaniaMapPreset } from '../algorithms/graphPresets';

// Requires the local engine on http://127.0.0.1:8000 (`npm run engine`).
const ALGO_TIMEOUT = 120_000;

describe('Python catalog algorithms execute end-to-end', () => {
  for (const algo of ALGORITHM_CATALOG) {
    it(
      `runs "${algo.id}"`,
      async () => {
        const res = await pythonExecutor.execute({
          code: algo.defaultPythonCode,
          input: algo.defaultInput,
          mode: 'instrumented',
        });
        expect(res.success, res.error?.message).toBe(true);
        expect(res.events.length).toBeGreaterThan(0);
      },
      ALGO_TIMEOUT
    );
  }
});

describe('Java catalog algorithms execute end-to-end', () => {
  for (const algo of ALGORITHM_CATALOG) {
    it(
      `runs "${algo.id}"`,
      async () => {
        const res = await javaExecutor.execute({
          code: algo.defaultJavaCode,
          input: algo.defaultInput,
          mode: 'instrumented',
          timeoutMs: 90000,
        });
        expect(res.success, res.error?.message).toBe(true);
        expect(res.events.length).toBeGreaterThan(0);
      },
      ALGO_TIMEOUT
    );
  }
});

describe('Python search algorithms produce correct results', () => {
  it(
    'BFS discovers a path to the goal',
    async () => {
      const bfs = ALGORITHM_CATALOG.find((a) => a.id === 'bfs')!;
      const res = await pythonExecutor.execute({
        code: bfs.defaultPythonCode,
        input: bfs.defaultInput,
        mode: 'instrumented',
      });
      const goal = res.events.find((e) => e.type === 'GOAL_FOUND');
      expect(goal).toBeDefined();
      expect(goal?.data?.path).toContain('F');
    },
    ALGO_TIMEOUT
  );

  it(
    'UCS finds the optimal Romania route (cost 418)',
    async () => {
      const ucs = ALGORITHM_CATALOG.find((a) => a.id === 'ucs')!;
      const res = await pythonExecutor.execute({
        code: ucs.defaultPythonCode,
        input: romaniaMapPreset,
        mode: 'instrumented',
      });
      const goal = res.events.find((e) => e.type === 'GOAL_FOUND');
      expect(goal).toBeDefined();
      expect(goal?.data?.totalCost).toBe(418);
    },
    ALGO_TIMEOUT
  );

  it(
    'A* finds the optimal Romania route (cost 418)',
    async () => {
      const astar = ALGORITHM_CATALOG.find((a) => a.id === 'a-star')!;
      const res = await pythonExecutor.execute({
        code: astar.defaultPythonCode,
        input: romaniaMapPreset,
        mode: 'instrumented',
      });
      const goal = res.events.find((e) => e.type === 'GOAL_FOUND');
      expect(goal).toBeDefined();
      expect(goal?.data?.totalCost).toBe(418);
    },
    ALGO_TIMEOUT
  );

  it(
    'bubble sort ends with a sorted array',
    async () => {
      const bubble = ALGORITHM_CATALOG.find((a) => a.id === 'bubble-sort')!;
      const res = await pythonExecutor.execute({
        code: bubble.defaultPythonCode,
        input: bubble.defaultInput,
        mode: 'instrumented',
      });
      const last = res.events[res.events.length - 1];
      const result = last?.stateSnapshot?.dataStructure as number[];
      expect(Array.isArray(result)).toBe(true);
      expect([...result]).toEqual([...result].sort((a, b) => a - b));
    },
    ALGO_TIMEOUT
  );
});
