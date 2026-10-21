import { describe, it, expect } from 'vitest';
import { pythonExecutor, javaExecutor } from '../engine/executor';
import { GraphData } from '../types/graph';

/**
 * A student's own search code usually never calls the `visualizer.*` API.
 * In Trace mode the engine must still derive graph highlighting from the
 * traced locals so the Interactive Visualization Canvas animates.
 */
const smallGraph: GraphData = {
  startNodeId: 'A',
  goalNodeId: 'E',
  nodes: [
    { id: 'A', label: 'A', x: 100, y: 100 },
    { id: 'B', label: 'B', x: 300, y: 100 },
    { id: 'C', label: 'C', x: 300, y: 300 },
    { id: 'D', label: 'D', x: 500, y: 200 },
    { id: 'E', label: 'E', x: 700, y: 200 },
  ],
  edges: [
    { id: 'e1', from: 'A', to: 'B', cost: 1, directed: false },
    { id: 'e2', from: 'A', to: 'C', cost: 1, directed: false },
    { id: 'e3', from: 'B', to: 'D', cost: 1, directed: false },
    { id: 'e4', from: 'C', to: 'D', cost: 1, directed: false },
    { id: 'e5', from: 'D', to: 'E', cost: 1, directed: false },
  ],
};

// A plain BFS with NO visualizer calls at all.
const plainBfs = `
from collections import deque
graph = {
    "A": [("B", 1), ("C", 1)],
    "B": [("A", 1), ("D", 1)],
    "C": [("A", 1), ("D", 1)],
    "D": [("B", 1), ("C", 1), ("E", 1)],
    "E": [("D", 1)],
}
start = "A"
goal = "E"
frontier = deque([[start]])
explored = set()
while frontier:
    path = frontier.popleft()
    node = path[-1]
    if node == goal:
        break
    if node in explored:
        continue
    explored.add(node)
    for nb, _ in graph[node]:
        if nb not in explored:
            frontier.append(path + [nb])
`;

describe('Trace mode auto-visualisation of student code', () => {
  it('derives visited nodes and the final path from locals (no visualizer API)', async () => {
    const res = await pythonExecutor.execute({
      code: plainBfs,
      input: smallGraph,
      mode: 'trace',
    });

    expect(res.success).toBe(true);

    // It still emits the per-line STEP records Trace mode is for...
    expect(res.events.filter((e) => e.type === 'STEP').length).toBeGreaterThan(10);
    // ...but it now also emits derived visualisation events.
    expect(res.events.some((e) => e.type === 'NODE_EXPANDED')).toBe(true);
    expect(res.events.some((e) => e.type === 'GOAL_FOUND')).toBe(true);

    const last = res.events[res.events.length - 1].stateSnapshot;
    // Every node reachable before the goal should be marked visited.
    expect(last.visitedNodes).toEqual(expect.arrayContaining(['A', 'B', 'C', 'D', 'E']));
    // The final path A -> B -> D -> E must be highlighted.
    expect(last.finalPath).toEqual(['A', 'B', 'D', 'E']);
  });

  it('works when node values only match graph labels, not ids', async () => {
    // Graph ids are cities with spaces in labels; code uses the labels.
    const graph: GraphData = {
      startNodeId: 'RimnicuVilcea',
      goalNodeId: 'Pitesti',
      nodes: [
        { id: 'RimnicuVilcea', label: 'Rimnicu Vilcea', x: 100, y: 100 },
        { id: 'Pitesti', label: 'Pitesti', x: 300, y: 100 },
        { id: 'Craiova', label: 'Craiova', x: 200, y: 300 },
      ],
      edges: [
        { id: 'e1', from: 'RimnicuVilcea', to: 'Pitesti', cost: 1, directed: false },
        { id: 'e2', from: 'Craiova', to: 'Pitesti', cost: 1, directed: false },
      ],
    };
    const code = `
graph = {
    "Rimnicu_Vilcea": ["Pitesti"],
    "Craiova": ["Pitesti"],
    "Pitesti": [],
}
start = "Rimnicu_Vilcea"
visited = set()
node = start
visited.add(node)
for neighbor in graph[node]:
    visited.add(neighbor)
path = ["Rimnicu_Vilcea", "Pitesti"]
`;
    const res = await pythonExecutor.execute({ code, input: graph, mode: 'trace' });
    expect(res.success).toBe(true);
    const last = res.events[res.events.length - 1].stateSnapshot;
    // "Rimnicu_Vilcea" normalises to the label "Rimnicu Vilcea".
    expect((last.visitedNodes ?? []).length).toBeGreaterThan(0);
    expect(last.finalPath).toEqual(['RimnicuVilcea', 'Pitesti']);
  });

  it('does not invent nodes when the code has no graph-like locals', async () => {
    const res = await pythonExecutor.execute({
      code: 'total = 0\nfor i in range(5):\n    total += i\n',
      input: smallGraph,
      mode: 'trace',
    });
    expect(res.success).toBe(true);
    // No NODE_EXPANDED/GOAL_FOUND should be fabricated from unrelated locals.
    expect(res.events.some((e) => e.type === 'NODE_EXPANDED')).toBe(false);
    expect(res.events.some((e) => e.type === 'GOAL_FOUND')).toBe(false);
  });

});

// A program that drives the visualizer API explicitly (Learning Mode's own use).
const apiBfs = `
start = input["startNodeId"]
goal = input["goalNodeId"]
queue = [start]
visited = {start}
while queue:
    current = queue.pop(0)
    visualizer.visit_node(current)
    for e in input["edges"]:
        if e["from"] == current and e["to"] not in visited:
            visited.add(e["to"])
            queue.append(e["to"])
            visualizer.traverse_edge(current, e["to"], e["cost"])
visualizer.mark_path(["A", "B", "D", "E"])
`;

describe('Learning (instrumented) mode auto-visualisation fallback', () => {
  it('derives highlighting for Python student code that never calls the API', async () => {
    const res = await pythonExecutor.execute({
      code: plainBfs,
      input: smallGraph,
      mode: 'instrumented',
    });
    expect(res.success).toBe(true);
    // No STEP events in Learning Mode, but the canvas still animates.
    expect(res.events.some((e) => e.type === 'STEP')).toBe(false);
    expect(res.events.some((e) => e.type === 'NODE_EXPANDED')).toBe(true);
    expect(res.events.some((e) => e.type === 'GOAL_FOUND')).toBe(true);

    const last = res.events[res.events.length - 1].stateSnapshot;
    expect(last.visitedNodes).toEqual(
      expect.arrayContaining(['A', 'B', 'C', 'D', 'E']),
    );
    expect(last.finalPath).toEqual(['A', 'B', 'D', 'E']);
  });

  it('respects the explicit visualizer API when the code uses it', async () => {
    const res = await pythonExecutor.execute({
      code: apiBfs,
      input: smallGraph,
      mode: 'instrumented',
    });
    expect(res.success).toBe(true);
    // The code calls visit_node exactly 5 times (A,B,C,D,E) and mark_path once.
    // The derived pass would add extra GOAL_FOUND/NODE_EXPANDED events from the
    // locals, so exact counts prove it stayed out of the way.
    expect(res.events.filter((e) => e.type === 'GOAL_FOUND').length).toBe(1);
    expect(res.events.filter((e) => e.type === 'NODE_EXPANDED').length).toBe(5);

    const last = res.events[res.events.length - 1].stateSnapshot;
    expect(last.visitedNodes).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(last.finalPath).toEqual(['A', 'B', 'D', 'E']);
  });

  it('derives highlighting for Java student code that never calls the API', async () => {
    const res = await javaExecutor.execute({
      code: javaPlainBfs,
      input: smallGraph,
      mode: 'instrumented',
    });
    expect(res.success).toBe(true);
    expect(res.events.some((e) => e.type === 'STEP')).toBe(false);
    const last = res.events[res.events.length - 1].stateSnapshot;
    expect(last.visitedNodes).toEqual(
      expect.arrayContaining(['A', 'B', 'C', 'D', 'E']),
    );
    expect(last.finalPath).toEqual(['A', 'B', 'D', 'E']);
  }, 60000);
});

// A plain Java BFS with NO SearchLab API calls at all.
const javaPlainBfs = `
import java.util.*;
class StudentBFS {
    public static void main(String[] args) {
        Map<String, List<String>> graph = new HashMap<>();
        graph.put("A", Arrays.asList("B", "C"));
        graph.put("B", Arrays.asList("D"));
        graph.put("C", Arrays.asList("D"));
        graph.put("D", Arrays.asList("E"));
        graph.put("E", new ArrayList<>());
        String start = "A";
        String goal = "E";
        Queue<String> queue = new LinkedList<>();
        Set<String> visited = new HashSet<>();
        Map<String, String> parent = new HashMap<>();
        List<String> path = new ArrayList<>();
        queue.add(start);
        visited.add(start);
        while (!queue.isEmpty()) {
            String node = queue.poll();
            if (node.equals(goal)) {
                String cur = node;
                while (cur != null) { path.add(0, cur); cur = parent.get(cur); }
                break;
            }
            for (String neighbor : graph.get(node)) {
                if (!visited.contains(neighbor)) {
                    visited.add(neighbor);
                    parent.put(neighbor, node);
                    queue.add(neighbor);
                }
            }
        }
        System.out.println("path=" + path);
    }
}
`;

describe('Trace mode auto-visualisation of Java student code', () => {
  it('derives visited nodes and the final path from JDI locals', async () => {
    const res = await javaExecutor.execute({
      code: javaPlainBfs,
      input: smallGraph,
      mode: 'trace',
    });

    expect(res.success).toBe(true);
    expect(res.events.filter((e) => e.type === 'STEP').length).toBeGreaterThan(0);
    expect(res.events.some((e) => e.type === 'NODE_EXPANDED')).toBe(true);
    expect(res.events.some((e) => e.type === 'GOAL_FOUND')).toBe(true);

    const last = res.events[res.events.length - 1].stateSnapshot;
    expect(last.visitedNodes).toEqual(
      expect.arrayContaining(['A', 'B', 'C', 'D', 'E']),
    );
    expect(last.finalPath).toEqual(['A', 'B', 'D', 'E']);
  }, 60000);
});
