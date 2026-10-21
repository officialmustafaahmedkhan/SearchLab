import { describe, it, expect } from 'vitest';
import { layoutNodes, withLayout, CANVAS_WIDTH, CANVAS_HEIGHT } from '../utils/graphLayout';
import { extractGraphFromCode, validateGraphData } from '../engine/executor';
import { GraphData, GraphNode } from '../types/graph';

// The extraction test talks to the local engine on http://127.0.0.1:8000.
const ENGINE_TIMEOUT = 30_000;

const PAKISTAN_CODE = `
from collections import deque

pakistan_graph = {
    'Karachi':   [('Hyderabad', 160), ('Sukkur', 360)],
    'Hyderabad': [('Karachi', 160), ('Sukkur', 200)],
    'Sukkur':    [('Karachi', 360), ('Hyderabad', 200), ('Multan', 370)],
    'Multan':    [('Sukkur', 370), ('Lahore', 340), ('Islamabad', 580)],
    'Lahore':    [('Multan', 340), ('Islamabad', 380)],
    'Islamabad': [('Lahore', 380), ('Multan', 580), ('Besham', 270)],
    'Besham':    [('Islamabad', 270), ('Gilgit', 360)],
    'Gilgit':    [('Besham', 360), ('Skardu', 220)],
    'Skardu':    [('Gilgit', 220)],
}

def bfs(graph, start, goal):
    frontier = deque([[start]])
    while frontier:
        path = frontier.popleft()
        node = path[-1]
        if node == goal:
            return path

if __name__ == "__main__":
    START = 'Karachi'
    GOAL  = 'Skardu'
    path = bfs(pakistan_graph, START, GOAL)
`;

const nodesWithoutCoords = (): GraphNode[] => [
  { id: 'A', label: 'A', x: NaN, y: NaN },
  { id: 'B', label: 'B', x: NaN, y: NaN },
  { id: 'C', label: 'C', x: NaN, y: NaN },
  { id: 'D', label: 'D', x: NaN, y: NaN },
];

describe('graph layout', () => {
  it('assigns finite, in-bounds coordinates to nodes that lack them', () => {
    const edges = [
      { id: 'e1', from: 'A', to: 'B', cost: 1, directed: false },
      { id: 'e2', from: 'B', to: 'C', cost: 1, directed: false },
      { id: 'e3', from: 'C', to: 'D', cost: 1, directed: false },
    ];
    const laid = layoutNodes(nodesWithoutCoords(), edges);
    for (const node of laid) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(CANVAS_WIDTH);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(CANVAS_HEIGHT);
    }
  });

  it('is deterministic and leaves existing coordinates untouched', () => {
    const withCoords: GraphNode[] = [
      { id: 'A', label: 'A', x: 100, y: 120 },
      { id: 'B', label: 'B', x: 300, y: 240 },
      { id: 'C', label: 'C', x: 500, y: 360 },
    ];
    const edges = [
      { id: 'e1', from: 'A', to: 'B', cost: 1, directed: false },
      { id: 'e2', from: 'B', to: 'C', cost: 1, directed: false },
    ];
    // layoutNodes must be a no-op when every node already has coordinates.
    expect(layoutNodes(withCoords, edges)).toEqual(withCoords);

    // Deterministic: same input -> same output.
    const first = layoutNodes(nodesWithoutCoords(), edges);
    const second = layoutNodes(nodesWithoutCoords(), edges);
    expect(first.map((n) => [n.x, n.y])).toEqual(second.map((n) => [n.x, n.y]));
  });

  it('returns an empty list unchanged', () => {
    expect(layoutNodes([], [])).toEqual([]);
  });

  it('withLayout applies coordinates to a graph', () => {
    const graph: GraphData = {
      nodes: nodesWithoutCoords(),
      edges: [
        { id: 'e1', from: 'A', to: 'B', cost: 1, directed: false },
        { id: 'e2', from: 'B', to: 'C', cost: 1, directed: false },
      ],
      startNodeId: 'A',
      goalNodeId: 'D',
    };
    const laid = withLayout(graph);
    expect(laid.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
    expect(laid.startNodeId).toBe('A');
    expect(laid.goalNodeId).toBe('D');
  });
});

describe('graph validation', () => {
  it('accepts a well-formed graph', () => {
    const graph: GraphData = {
      nodes: [
        { id: 'A', label: 'A', x: 10, y: 20 },
        { id: 'B', label: 'B', x: 30, y: 40 },
      ],
      edges: [{ id: 'e1', from: 'A', to: 'B', cost: 5, directed: false }],
      startNodeId: 'A',
      goalNodeId: 'B',
    };
    expect(validateGraphData(graph)).toEqual([]);
  });

  it('rejects missing arrays, unknown endpoints, and duplicate ids', () => {
    expect(validateGraphData(null)).toEqual(['Graph must be a JSON object.']);
    expect(validateGraphData({})).toEqual(["Graph must contain a non-empty 'nodes' array."]);
    expect(validateGraphData({ nodes: [{ id: 'A', x: 1, y: 2 }], edges: [] })).toEqual([]);

    const bad = {
      nodes: [
        { id: 'A', label: 'A', x: 1, y: 2 },
        { id: 'A', label: 'dup', x: 3, y: 4 },
      ],
      edges: [{ id: 'e1', from: 'A', to: 'Z', cost: 1 }],
      startNodeId: 'A',
      goalNodeId: 'Z',
    };
    const errors = validateGraphData(bad);
    expect(errors.some((e) => e.includes('unique'))).toBe(true);
    expect(errors.some((e) => e.includes('unknown to'))).toBe(true);
    expect(errors.some((e) => e.includes('goalNodeId'))).toBe(true);
  });

  it('requires numeric edge costs but tolerates missing coordinates', () => {
    const errors = validateGraphData({
      nodes: [
        { id: 'A', label: 'A', x: 'nope', y: 2 },
        { id: 'B', label: 'B', x: 3, y: 4 },
      ],
      edges: [{ id: 'e1', from: 'A', to: 'B', cost: 'x' }],
    });
    // Coordinates are optional (the layout step supplies them)...
    expect(errors.some((e) => e.includes('non-numeric x'))).toBe(false);
    // ...but a non-numeric cost is still an error.
    expect(errors.some((e) => e.includes('non-numeric "cost"'))).toBe(true);
  });
});

describe('graph extraction from code (engine)', () => {
  it(
    'extracts the graph defined in pasted algorithm code',
    async () => {
      const outcome = await extractGraphFromCode(PAKISTAN_CODE);
      expect(outcome.ok).toBe(true);
      expect(outcome.graph).not.toBeNull();
      const graph = outcome.graph!;
      expect(graph.nodes.length).toBe(9);
      expect(graph.edges.length).toBe(20);
      expect(graph.nodes.map((n) => n.id)).toContain('Karachi');
      expect(graph.nodes.map((n) => n.id)).toContain('Skardu');
      // START / GOAL were read from the __main__ block.
      expect(graph.startNodeId).toBe('Karachi');
      expect(graph.goalNodeId).toBe('Skardu');
      // Extracted nodes have no coordinates yet; the layout step adds them.
      const laid = withLayout(graph);
      expect(laid.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
    },
    ENGINE_TIMEOUT
  );

  it(
    'supports dict-of-dicts adjacency lists',
    async () => {
      const code = 'graph = {"A": {"B": 5, "C": 2}, "B": {"D": 4}, "C": {"D": 7}, "D": {}}';
      const outcome = await extractGraphFromCode(code);
      expect(outcome.ok).toBe(true);
      expect(outcome.graph!.nodes.length).toBe(4);
      expect(outcome.graph!.edges.length).toBe(4);
    },
    ENGINE_TIMEOUT
  );

  it(
    'reports a friendly message when there is no graph to extract',
    async () => {
      const outcome = await extractGraphFromCode('def f(x):\n    return x + 1\n');
      expect(outcome.ok).toBe(false);
      expect(outcome.graph).toBeNull();
      expect(outcome.message.toLowerCase()).toContain('no graph');
    },
    ENGINE_TIMEOUT
  );

  it(
    'handles empty input without contacting the engine',
    async () => {
      const outcome = await extractGraphFromCode('   ');
      expect(outcome.ok).toBe(false);
      expect(outcome.message).toContain('empty');
    },
    ENGINE_TIMEOUT
  );
});
