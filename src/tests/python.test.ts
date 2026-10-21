import { describe, it, expect } from 'vitest';
import { pythonExecutor } from '../engine/executor';
import { romaniaMapPreset } from '../algorithms/graphPresets';

describe('SearchLab Python Engine Execution Tests', () => {
  it('should execute Python Bubble Sort and record real comparison and swap events', async () => {
    const pyCode = `
arr = list(input)
n = len(arr)
for i in range(n - 1):
    for j in range(n - i - 1):
        if visualizer.compare(j, j + 1):
            visualizer.swap(j, j + 1)
            arr[j], arr[j + 1] = arr[j + 1], arr[j]
print("Python Sorted:", arr)
`;
    const input = [30, 10, 50, 20];
    const res = await pythonExecutor.execute({
      code: pyCode,
      input,
      mode: 'instrumented',
    });

    expect(res.success).toBe(true);
    expect(res.events.length).toBeGreaterThan(0);

    const swaps = res.events.filter((e) => e.type === 'ARRAY_SWAPPED');
    expect(swaps.length).toBeGreaterThan(0);
    expect(swaps[swaps.length - 1].data.newArray).toEqual([10, 20, 30, 50]);
    expect(res.logs).toContain('Python Sorted: [10, 20, 30, 50]');
  });

  it('should execute Python Breadth-First Search (BFS) and find target node', async () => {
    const pyBfs = `
nodes = input["nodes"]
edges = input["edges"]
start = input["startNodeId"]
goal = input["goalNodeId"]

adj = {n["id"]: [] for n in nodes}
for e in edges:
    adj[e["from"]].append(e["to"])
    if not e["directed"]:
        adj[e["to"]].append(e["from"])

queue = [start]
visited = {start}
parent = {}

while queue:
    curr = queue.pop(0)
    visualizer.visit_node(curr)
    if curr == goal:
        break
    for neighbor in adj[curr]:
        if neighbor not in visited:
            visited.add(neighbor)
            parent[neighbor] = curr
            queue.append(neighbor)
            visualizer.update_queue(list(queue))

path = []
c = goal
while c:
    path.insert(0, c)
    c = parent.get(c)

visualizer.mark_path(path)
`;
    const res = await pythonExecutor.execute({
      code: pyBfs,
      input: romaniaMapPreset,
      mode: 'instrumented',
    });

    expect(res.success).toBe(true);
    const goalEvent = res.events.find((e) => e.type === 'GOAL_FOUND');
    expect(goalEvent).toBeDefined();
    expect(goalEvent?.data?.path[0]).toBe('Arad');
    expect(goalEvent?.data?.path[goalEvent.data.path.length - 1]).toBe('Bucharest');
  });

  it('runs the code inside an `if __name__ == "__main__":` entry-point block', async () => {
    // Student scripts almost always guard their driver code this way. The
    // program must run as __main__, not be silently skipped.
    const pyMainGuard = `
def solve(items):
    return [x * 2 for x in items]

if __name__ == "__main__":
    result = solve([1, 2, 3])
    print("result:", result)
`;
    const res = await pythonExecutor.execute({
      code: pyMainGuard,
      input: [],
      mode: 'instrumented',
    });

    expect(res.success).toBe(true);
    // The block must actually have executed.
    expect(res.logs.join('\n')).toContain('result: [2, 4, 6]');
  });

  it('should capture Python syntax and runtime errors with tracebacks', async () => {
    const brokenPy = `
# Intentional Python ZeroDivisionError
x = 10 / 0
`;
    const res = await pythonExecutor.execute({
      code: brokenPy,
      input: [],
      mode: 'instrumented',
    });

    expect(res.success).toBe(false);
    expect(res.error?.message).toContain('division by zero');
    expect(res.events.some((e) => e.type === 'EXECUTION_ERROR')).toBe(true);
  });
});
