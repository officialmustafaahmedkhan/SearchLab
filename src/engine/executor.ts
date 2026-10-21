import { ExecutionLanguage, ExecutionRequest, ExecutionResult } from '../types/execution';
import { GraphData } from '../types/graph';
import { normalizeGraphCoordinates } from '../utils/graphLayout';

export interface ExecutionAdapter {
  id: string;
  name: string;
  language: ExecutionLanguage;
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
  terminate(): void;
}

/**
 * Result of asking the engine to pull a graph out of user source code.
 * `nodes`/`edges` have no coordinates (the layout step assigns them).
 */
export interface ExtractedGraph {
  found: boolean;
  nodes: GraphData['nodes'];
  edges: GraphData['edges'];
  startNodeId?: string;
  goalNodeId?: string;
  startDetected?: boolean;
  goalDetected?: boolean;
  source?: string;
}

/** Outcome of {@link extractGraphFromCode}, including a user-facing message. */
export interface ExtractOutcome {
  graph: GraphData | null;
  message: string;
  ok: boolean;
}

/**
 * Base URL of the SearchLab execution engine.
 *
 * Configurable at build time via the `VITE_ENGINE_URL` environment variable:
 *
 *   - Local development: leave unset (defaults to `http://127.0.0.1:8000`).
 *   - Vercel (same-origin): set to `/api`, which the bundled Python function
 *     under `api/index.py` serves. Note that Vercel has no JDK, so the Java
 *     option is hidden there (see `fetchEngineCapabilities`).
 *   - Separate engine host: set to the full URL, e.g.
 *     `https://searchlab-engine.fly.dev`.
 */
const ENGINE_URL = (
  (import.meta.env?.VITE_ENGINE_URL as string | undefined)?.replace(/\/+$/, '') ||
  'http://127.0.0.1:8000'
);

/** Upper bound on graph size, mirrored from the engine's MAX_EXTRACTED_NODES. */
const MAX_GRAPH_NODES = 120;

/**
 * Base adapter for the languages supported by the local SearchLab engine
 * (Python and Java). Both languages are executed by the FastAPI service in
 * `python_engine.py`; this class only knows how to talk to the right endpoint
 * and normalise the response into an {@link ExecutionResult}.
 */
abstract class EngineAdapter implements ExecutionAdapter {
  public abstract id: string;
  public abstract name: string;
  public abstract language: ExecutionLanguage;
  protected abstract endpoint: string;

  public async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? 30000);

      const response = await fetch(`${ENGINE_URL}${this.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: request.code,
          input: request.input,
          mode: request.mode,
          max_events: request.maxEvents ?? 20000,
          time_limit_ms: request.timeLimitMs,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Execution server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        success: data.success,
        events: data.events || [],
        finalOutput: data.finalOutput,
        error: data.error,
        totalSteps: data.totalSteps ?? (data.events || []).length,
        durationMs: data.durationMs || 0,
        logs: data.logs || [],
      };
    } catch (err: any) {
      const aborted = err?.name === 'AbortError';
      return {
        success: false,
        events: [],
        error: {
          message: aborted
            ? 'Execution timed out. Possible infinite loop.'
            : `${this.name} error: ${err.message}. Ensure the SearchLab engine is reachable at ${ENGINE_URL} (locally, start it with "npm run engine").`,
        },
        totalSteps: 0,
        durationMs: 0,
        logs: [err.message],
      };
    }
  }

  public terminate() {
    // The engine enforces its own timeouts; nothing to cancel client-side.
  }
}

export class PythonExecutionAdapter extends EngineAdapter {
  public id = 'python-engine';
  public name = 'Python';
  public language: ExecutionLanguage = 'python';
  protected endpoint = '/execute';
}

export class JavaExecutionAdapter extends EngineAdapter {
  public id = 'java-engine';
  public name = 'Java';
  public language: ExecutionLanguage = 'java';
  protected endpoint = '/execute-java';
}

export const pythonExecutor = new PythonExecutionAdapter();
export const javaExecutor = new JavaExecutionAdapter();

/** Resolve the adapter for a language. */
export function getExecutor(language: ExecutionLanguage): ExecutionAdapter {
  return language === 'java' ? javaExecutor : pythonExecutor;
}

/**
 * Languages the engine can actually execute right now.
 *
 * Hosted engines without a JDK (e.g. Vercel serverless) report Python only; in
 * that case the frontend hides the Java option instead of letting it fail.
 */
export interface EngineCapabilities {
  online: boolean;
  languages: ExecutionLanguage[];
}

/**
 * Probe the engine's `/health` endpoint for the languages it supports.
 *
 * Never throws: if the engine is unreachable we return an offline result so the
 * UI can show a clear message rather than an unhandled rejection.
 */
export async function fetchEngineCapabilities(): Promise<EngineCapabilities> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${ENGINE_URL}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { online: false, languages: ['python', 'java'] };
    }

    const data = await response.json();
    const languages: ExecutionLanguage[] = Array.isArray(data?.languages)
      ? data.languages.filter(
          (lang: unknown): lang is ExecutionLanguage =>
            lang === 'python' || lang === 'java',
        )
      : [];
    return {
      online: true,
      // A healthy engine always supports Python; fall back to it rather than
      // showing no language at all if the field is missing.
      languages: languages.length ? languages : ['python'],
    };
  } catch {
    return { online: false, languages: ['python', 'java'] };
  }
}

/**
 * Ask the engine to extract a graph defined inside source code (e.g. a Python
 * `graph = {...}` adjacency list). Layout coordinates are added by the caller.
 */
export async function extractGraphFromCode(code: string): Promise<ExtractOutcome> {
  if (!code || !code.trim()) {
    return { graph: null, message: 'The editor is empty.', ok: false };
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(`${ENGINE_URL}/extract-graph`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return {
        graph: null,
        message: `Extraction failed (HTTP ${response.status}).`,
        ok: false,
      };
    }

    const data = (await response.json()) as ExtractedGraph;
    if (!data.found || !data.nodes?.length) {
      return {
        graph: null,
        message:
          "No graph found in the code. Define an adjacency list such as graph = {'A': [('B', 5)], ...}.",
        ok: false,
      };
    }

    const graph: GraphData = {
      nodes: data.nodes,
      edges: data.edges,
      startNodeId: data.startNodeId || data.nodes[0]?.id || '',
      goalNodeId: data.goalNodeId || data.nodes[data.nodes.length - 1]?.id || '',
    };

    // Assign coordinates up-front (extracted nodes are geometry-free) then
    // validate so callers always receive a directly renderable graph.
    const placed = normalizeGraphCoordinates(graph);
    const errors = validateGraphData(placed);
    if (errors.length > 0) {
      return { graph: null, message: errors[0], ok: false };
    }

    const label = data.source ? `"${data.source}"` : 'code';
    const startNote = data.startDetected ? '' : ' (start defaulted)';
    const goalNote = data.goalDetected ? '' : ' (goal defaulted)';
    return {
      graph: placed,
      ok: true,
      message: `Loaded ${placed.nodes.length} nodes and ${placed.edges.length} edges from ${label}${startNote}${goalNote}.`,
    };
  } catch (err: any) {
    const aborted = err?.name === 'AbortError';
    return {
      graph: null,
      message: aborted
        ? 'Graph extraction timed out.'
        : `Could not reach the engine to extract a graph (${err?.message ?? err}).`,
      ok: false,
    };
  }
}

/**
 * Validate a {@link GraphData} object (used for imported/pasted JSON). Returns
 * a list of human-readable problems; an empty list means the graph is valid.
 *
 * Coordinates are checked with {@link normalizeGraphCoordinates}, so nodes
 * whose `x`/`y` are missing or non-numeric are treated as "to be laid out"
 * rather than invalid.
 */
export function validateGraphData(graph: any): string[] {
  const errors: string[] = [];
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) {
    return ['Graph must be a JSON object.'];
  }
  const nodes = graph.nodes;
  const edges = graph.edges;
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return ["Graph must contain a non-empty 'nodes' array."];
  }
  if (!Array.isArray(edges)) {
    return ["Graph must contain an 'edges' array."];
  }

  const ids: string[] = [];
  nodes.forEach((node: any, index: number) => {
    if (!node || typeof node !== 'object') {
      errors.push(`Node ${index} is not an object.`);
      return;
    }
    if (typeof node.id !== 'string' || !node.id) {
      errors.push(`Node ${index} is missing a string "id".`);
      return;
    }
    ids.push(node.id);
  });
  if (new Set(ids).size !== ids.length) {
    errors.push('Node ids must be unique.');
  }
  if (ids.length > MAX_GRAPH_NODES) {
    errors.push(`Graph has ${ids.length} nodes; the visualizer supports at most ${MAX_GRAPH_NODES}.`);
  }

  const idSet = new Set(ids);
  edges.forEach((edge: any, index: number) => {
    if (!edge || typeof edge !== 'object') {
      errors.push(`Edge ${index} is not an object.`);
      return;
    }
    (['from', 'to'] as const).forEach((endpoint) => {
      if (!idSet.has(edge[endpoint])) {
        errors.push(`Edge ${index} references unknown ${endpoint} "${edge[endpoint]}".`);
      }
    });
    if (typeof edge.cost !== 'number' || !Number.isFinite(edge.cost)) {
      errors.push(`Edge ${index} has a non-numeric "cost".`);
    }
  });

  (['startNodeId', 'goalNodeId'] as const).forEach((endpoint) => {
    const value = graph[endpoint];
    if (value != null && !idSet.has(value)) {
      errors.push(`"${endpoint}" references unknown node "${value}".`);
    }
  });

  return errors;
}
