export type EventType =
  | 'NODE_CREATED'
  | 'EDGE_CREATED'
  | 'NODE_DISCOVERED'
  | 'NODE_SELECTED'
  | 'NODE_EXPANDED'
  | 'EDGE_RELAXED'
  | 'COST_UPDATED'
  | 'QUEUE_UPDATED'
  | 'STACK_UPDATED'
  | 'ARRAY_COMPARED'
  | 'ARRAY_SWAPPED'
  | 'ARRAY_WRITTEN'
  | 'ARRAY_PIVOT'
  | 'SUBARRAY_FOCUSED'
  | 'ELEMENT_FOUND'
  | 'RECURSION_ENTERED'
  | 'RECURSION_RETURNED'
  | 'TREE_VISITED'
  | 'TREE_INSERTED'
  | 'HASH_INSERTED'
  | 'HASH_COLLISION'
  | 'GOAL_FOUND'
  | 'ALGORITHM_COMPLETED'
  | 'LOG_MESSAGE'
  | 'STEP'
  | 'EXECUTION_ERROR';

export interface ExecutionMetrics {
  comparisons: number;
  swaps: number;
  writes: number;
  nodesVisited: number;
  edgesTraversed: number;
  pathCost?: number;
  queueSize?: number;
  maxMemorySteps?: number;
  timeElapsedMs: number;
}

export interface StateSnapshot {
  dataStructure: any; // Array, Graph state, Tree, or Hash table
  variables: Record<string, any>;
  callStack?: string[];
  activeIndices?: number[];
  secondaryIndices?: number[];
  activeNodes?: string[];
  visitedNodes?: string[];
  activeEdges?: [string, string][];
  finalPath?: string[];
  queueItems?: any[];
  stackItems?: any[];
  metrics: ExecutionMetrics;
  consoleLogs: string[];
}

export interface ExecutionEvent {
  id: number;
  type: EventType;
  line?: number;
  timestamp: number;
  description: string;
  data?: any;
  stateSnapshot: StateSnapshot;
}

export type ExecutionMode = 'instrumented' | 'trace';

export type ExecutionLanguage = 'python' | 'java';

export interface ExecutionRequest {
  code: string;
  input: any;
  mode: ExecutionMode;
  language?: ExecutionLanguage;
  timeoutMs?: number;
  maxEvents?: number;
  /** Server-side wall-clock limit (ms) guarding against infinite loops. */
  timeLimitMs?: number;
}

export interface ExecutionResult {
  success: boolean;
  events: ExecutionEvent[];
  finalOutput?: any;
  error?: {
    message: string;
    line?: number;
    column?: number;
    stack?: string;
  };
  totalSteps: number;
  durationMs: number;
  logs: string[];
}
