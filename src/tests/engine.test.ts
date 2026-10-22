import { describe, it, expect } from 'vitest';
import {
  pythonExecutor,
  javaExecutor,
  fetchEngineCapabilities,
  decideEngineUrl,
} from '../engine/executor';
import { ALGORITHM_CATALOG } from '../algorithms/catalog';

// These tests exercise the local SearchLab execution engine
// (python_engine.py on http://127.0.0.1:8000). Start it with `npm run engine`
// before running the suite.
const ENGINE_TIMEOUT = 60_000;

describe('SearchLab catalog integrity', () => {
  it('defines a non-empty Python and Java sample for every algorithm', () => {
    expect(ALGORITHM_CATALOG.length).toBeGreaterThan(0);
    for (const algo of ALGORITHM_CATALOG) {
      expect(algo.defaultPythonCode, `${algo.id} defaultPythonCode`).toBeTruthy();
      expect(algo.defaultJavaCode, `${algo.id} defaultJavaCode`).toBeTruthy();
      expect(algo.defaultPythonCode.trim().length).toBeGreaterThan(10);
      expect(algo.defaultJavaCode.trim().length).toBeGreaterThan(10);
      // The legacy JavaScript field must be gone.
      expect((algo as unknown as Record<string, unknown>).defaultCode).toBeUndefined();
    }
  });

  it('contains no JavaScript-only syntax in the Python or Java samples', () => {
    for (const algo of ALGORITHM_CATALOG) {
      // Java programs must define the expected entry point class.
      expect(algo.defaultJavaCode).toContain('class Main');
      // No leftover JavaScript constructs (arrow functions, const/let).
      for (const sample of [algo.defaultPythonCode, algo.defaultJavaCode]) {
        expect(sample).not.toMatch(/=>/);
        expect(sample).not.toMatch(/\bconst\b/);
        expect(sample).not.toMatch(/\blet\b/);
      }
    }
  });
});

describe('Engine capabilities', () => {
  it(
    'reports its languages and always advertises Python when online',
    async () => {
      const caps = await fetchEngineCapabilities();
      expect(caps.online).toBe(true);
      // A reachable engine must always be able to run Python.
      expect(caps.languages).toContain('python');
      // Only Python and Java are ever advertised (no JavaScript).
      for (const lang of caps.languages) {
        expect(['python', 'java']).toContain(lang);
      }
    },
    ENGINE_TIMEOUT
  );

  it('falls back to the offline default instead of throwing when unreachable', async () => {
    // Point the probe at a closed port via a bad fetch and ensure it never
    // rejects: an unreachable engine must not crash the app.
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() =>
      Promise.reject(new Error('simulated network failure'))) as typeof fetch;
    try {
      const caps = await fetchEngineCapabilities();
      expect(caps.online).toBe(false);
      // Offline should not hide Java behind an accidental empty list.
      expect(caps.languages).toContain('python');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

/**
 * The hosted build broke once because the engine URL resolved to
 * `http://127.0.0.1:8000`, i.e. the *visitor's own machine*, so every device
 * except the developer's laptop failed with "Failed to fetch". These tests pin
 * the resolution rules so that cannot come back silently.
 */
describe('Engine URL resolution', () => {
  const deployed = { hostname: 'searchlab-mak.vercel.app', origin: 'https://searchlab-mak.vercel.app' };
  const local = { hostname: 'localhost', origin: 'http://localhost:5173' };

  it('uses the page origin on a deployed site when nothing is configured', () => {
    expect(decideEngineUrl(undefined, deployed)).toBe('https://searchlab-mak.vercel.app');
  });

  it('uses the local engine on localhost when nothing is configured', () => {
    expect(decideEngineUrl(undefined, local)).toBe('http://127.0.0.1:8000');
  });

  it('ignores a localhost VITE_ENGINE_URL on a deployed site', () => {
    // The exact misconfiguration that made the app work only on the
    // developer's machine.
    expect(decideEngineUrl('http://127.0.0.1:8000', deployed)).toBe(
      'https://searchlab-mak.vercel.app'
    );
    expect(decideEngineUrl('http://localhost:8000', deployed)).toBe(
      'https://searchlab-mak.vercel.app'
    );
  });

  it('honours an explicit non-localhost engine host', () => {
    expect(decideEngineUrl('https://engine.example.com', deployed)).toBe(
      'https://engine.example.com'
    );
  });

  it('strips trailing slashes from a configured value', () => {
    expect(decideEngineUrl('https://engine.example.com///', deployed)).toBe(
      'https://engine.example.com'
    );
  });

  it('never resolves to localhost on a deployed site', () => {
    for (const value of [undefined, '', '  ', 'http://127.0.0.1:8000', '/api']) {
      const url = decideEngineUrl(value, deployed);
      expect(url).not.toContain('127.0.0.1');
      expect(url).not.toContain('localhost');
    }
  });
});

describe('Python engine', () => {
  it(
    'executes the default BFS and finds the goal',
    async () => {
      const bfs = ALGORITHM_CATALOG.find((a) => a.id === 'bfs')!;
      const res = await pythonExecutor.execute({
        code: bfs.defaultPythonCode,
        input: bfs.defaultInput,
        mode: 'instrumented',
      });
      expect(res.success).toBe(true);
      expect(res.events.length).toBeGreaterThan(3);
      expect(res.events.some((e) => e.type === 'GOAL_FOUND')).toBe(true);
    },
    ENGINE_TIMEOUT
  );

  it(
    'emits per-line STEP events in trace mode',
    async () => {
      const bfs = ALGORITHM_CATALOG.find((a) => a.id === 'bfs')!;
      const res = await pythonExecutor.execute({
        code: bfs.defaultPythonCode,
        input: bfs.defaultInput,
        mode: 'trace',
      });
      expect(res.success).toBe(true);
      const steps = res.events.filter((e) => e.type === 'STEP');
      expect(steps.length).toBeGreaterThan(10);
      // Every STEP record must carry a source line for the graph to follow.
      expect(steps.every((e) => typeof e.line === 'number')).toBe(true);
    },
    ENGINE_TIMEOUT
  );

  it(
    'guards against infinite loops in both modes',
    async () => {
      const loop = 'x = 0\nwhile True:\n    x += 1\n';
      // Trace mode hits the event cap.
      const traced = await pythonExecutor.execute({
        code: loop,
        input: {},
        mode: 'trace',
        maxEvents: 300,
      });
      expect(traced.success).toBe(false);
      expect(traced.error).toBeDefined();

      // Instrumented mode has no visualizer calls, so the wall-clock limit
      // must stop it.
      const instrumented = await pythonExecutor.execute({
        code: loop,
        input: {},
        mode: 'instrumented',
        timeLimitMs: 1000,
      });
      expect(instrumented.success).toBe(false);
      expect(instrumented.error).toBeDefined();
    },
    ENGINE_TIMEOUT
  );

  it(
    'captures runtime errors with a message',
    async () => {
      const res = await pythonExecutor.execute({
        code: 'x = 10 / 0\n',
        input: {},
        mode: 'instrumented',
      });
      expect(res.success).toBe(false);
      expect(res.error?.message).toContain('division by zero');
      expect(res.events.some((e) => e.type === 'EXECUTION_ERROR')).toBe(true);
    },
    ENGINE_TIMEOUT
  );
});

describe('Java engine', () => {
  it(
    'executes the default BFS and finds the goal',
    async () => {
      const bfs = ALGORITHM_CATALOG.find((a) => a.id === 'bfs')!;
      const res = await javaExecutor.execute({
        code: bfs.defaultJavaCode,
        input: bfs.defaultInput,
        mode: 'instrumented',
        timeoutMs: 60000,
      });
      expect(res.success).toBe(true);
      expect(res.events.length).toBeGreaterThan(3);
      expect(res.events.some((e) => e.type === 'GOAL_FOUND')).toBe(true);
    },
    ENGINE_TIMEOUT
  );

  it(
    'emits per-line STEP events in JDI trace mode',
    async () => {
      const bfs = ALGORITHM_CATALOG.find((a) => a.id === 'bfs')!;
      const res = await javaExecutor.execute({
        code: bfs.defaultJavaCode,
        input: bfs.defaultInput,
        mode: 'trace',
      });
      expect(res.success).toBe(true);
      const steps = res.events.filter((e) => e.type === 'STEP');
      expect(steps.length).toBeGreaterThan(10);
    },
    ENGINE_TIMEOUT
  );
});
