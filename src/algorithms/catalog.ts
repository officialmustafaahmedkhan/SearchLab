import { AlgorithmDefinition } from '../types/algorithms';
import { romaniaMapPreset, simpleGraphPreset, dagPreset } from './graphPresets';

export const ALGORITHM_CATALOG: AlgorithmDefinition[] = [
  // ==========================================
  // AI SEARCH ALGORITHMS
  // ==========================================
  {
    id: 'bfs',
    name: 'Breadth-First Search (BFS)',
    category: 'ai-search',
    target: 'graph',
    timeComplexity: {
      best: 'O(V + E)',
      average: 'O(V + E)',
      worst: 'O(V + E)',
    },
    spaceComplexity: 'O(V)',
    shortDescription: 'Explores neighboring nodes level-by-level using a FIFO queue. Guaranteed to find the shortest path in unweighted graphs.',
    detailedExplanation: `Breadth-First Search (BFS) is a fundamental graph traversal algorithm. Starting from a chosen root/source node, it explores all neighbor nodes at the current depth level before moving on to nodes at the next depth level.
    
In SearchLab, you can see how each node is placed into a FIFO queue (the frontier), visited, and how parent pointers are maintained to reconstruct the exact path once the goal is reached.`,
    pseudocode: `function BFS(graph, start, goal):
    queue = [start]
    visited = {start}
    parent = {}

    while queue is not empty:
        node = queue.pop(0)
        if node == goal:
            return reconstruct_path(parent, goal)

        for neighbor in graph.neighbors(node):
            if neighbor not in visited:
                visited.add(neighbor)
                parent[neighbor] = node
                queue.push(neighbor)`,
    defaultInput: simpleGraphPreset,
    examplePresets: [
      { name: 'Simple 6-Node Graph', input: simpleGraphPreset },
      { name: 'Romania Map', input: romaniaMapPreset },
      { name: 'DAG Network', input: dagPreset },
    ],
    defaultPythonCode: `
nodes = input["nodes"]
edges = input["edges"]
start = input["startNodeId"]
goal = input["goalNodeId"]

adj = {n["id"]: [] for n in nodes}
for e in edges:
    adj[e["from"]].append((e["to"], e["cost"]))
    if not e["directed"]:
        adj[e["to"]].append((e["from"], e["cost"]))


def reconstruct(parent, start, goal):
    path = []
    node = goal
    while node is not None:
        path.insert(0, node)
        if node == start:
            break
        node = parent.get(node)
    return path

queue = [start]
visited = {start}
parent = {}
visualizer.update_queue(list(queue))

found = False
while queue:
    current = queue.pop(0)
    visualizer.visit_node(current)
    visualizer.update_queue(list(queue))
    if current == goal:
        found = True
        break
    for neighbor, cost in adj[current]:
        if neighbor not in visited:
            visited.add(neighbor)
            parent[neighbor] = current
            queue.append(neighbor)
            visualizer.traverse_edge(current, neighbor, cost)
            visualizer.discover_node(neighbor, cost)

if found:
    path = reconstruct(parent, start, goal)
    visualizer.mark_path(path)
    print("BFS path:", " -> ".join(path))
else:
    print("Goal not reachable")
`,
    defaultJavaCode: `
import java.util.*;

public class Main {
    static SearchLab.Visualizer v = SearchLab.viz;
    static Map<String, Object> input;
    static Map<String, List<SearchLab.Edge>> adj;
    static String start, goal;

    public static void main(String[] args) {
        input = SearchLab.loadInputMap(args);
        adj = SearchLab.adjacency(input);
        start = SearchLab.start(input);
        goal = SearchLab.goal(input);
        LinkedList<String> queue = new LinkedList<>();
        Set<String> visited = new HashSet<>();
        Map<String, String> parent = new HashMap<>();
        queue.add(start);
        visited.add(start);
        v.updateQueue(new ArrayList<>(queue));

        boolean found = false;
        while (!queue.isEmpty()) {
            String current = queue.poll();
            v.visitNode(current);
            v.updateQueue(new ArrayList<>(queue));
            if (current.equals(goal)) {
                found = true;
                break;
            }
            for (SearchLab.Edge edge : adj.get(current)) {
                if (!visited.contains(edge.node)) {
                    visited.add(edge.node);
                    parent.put(edge.node, current);
                    queue.add(edge.node);
                    v.traverseEdge(current, edge.node, edge.cost);
                    v.discoverNode(edge.node, edge.cost);
                }
            }
        }

        if (found) {
            List<String> path = pathFrom(parent, goal);
            v.markPath(path);
            System.out.println("BFS path: " + String.join(" -> ", path));
        } else {
            System.out.println("Goal not reachable");
        }

        SearchLab.flush();
    }
    static List<String> pathFrom(Map<String, String> parent, String goal) {
        List<String> path = new ArrayList<>();
        String c = goal;
        while (c != null) {
            path.add(0, c);
            c = parent.get(c);
        }
        return path;
    }
}
`,
  },

  {
    id: 'dfs',
    name: 'Depth-First Search (DFS)',
    category: 'ai-search',
    target: 'graph',
    timeComplexity: {
      best: 'O(V + E)',
      average: 'O(V + E)',
      worst: 'O(V + E)',
    },
    spaceComplexity: 'O(V)',
    shortDescription: 'Explores as deep as possible along each branch before backtracking using a LIFO stack.',
    detailedExplanation: `Depth-First Search (DFS) dives deeply into a graph or tree along each branch before backtracking. It utilizes a stack (either the call stack via recursion, or an explicit LIFO structure). 

While DFS is memory efficient (O(bm) where b is branching factor and m is maximum depth), it is not guaranteed to find the shortest path.`,
    pseudocode: `function DFS(graph, start, goal):
    stack = [start]
    visited = set()
    parent = {}

    while stack is not empty:
        node = stack.pop()
        if node in visited: continue
        visited.add(node)

        if node == goal:
            return reconstruct_path(parent, goal)

        for neighbor in graph.neighbors(node):
            if neighbor not in visited:
                parent[neighbor] = node
                stack.push(neighbor)`,
    defaultInput: simpleGraphPreset,
    examplePresets: [
      { name: 'Simple 6-Node Graph', input: simpleGraphPreset },
      { name: 'Romania Map', input: romaniaMapPreset },
    ],
    defaultPythonCode: `
nodes = input["nodes"]
edges = input["edges"]
start = input["startNodeId"]
goal = input["goalNodeId"]

adj = {n["id"]: [] for n in nodes}
for e in edges:
    adj[e["from"]].append((e["to"], e["cost"]))
    if not e["directed"]:
        adj[e["to"]].append((e["from"], e["cost"]))


def reconstruct(parent, start, goal):
    path = []
    node = goal
    while node is not None:
        path.insert(0, node)
        if node == start:
            break
        node = parent.get(node)
    return path

stack = [start]
visited = set()
parent = {}
found = False

while stack:
    current = stack.pop()
    if current in visited:
        continue
    visited.add(current)
    visualizer.visit_node(current)
    if current == goal:
        found = True
        break
    for neighbor, cost in adj[current]:
        if neighbor not in visited:
            parent[neighbor] = current
            stack.append(neighbor)
            visualizer.traverse_edge(current, neighbor, cost)

if found:
    path = reconstruct(parent, start, goal)
    visualizer.mark_path(path)
    print("DFS path:", " -> ".join(path))
else:
    print("Goal not reachable")
`,
    defaultJavaCode: `
import java.util.*;

public class Main {
    static SearchLab.Visualizer v = SearchLab.viz;
    static Map<String, Object> input;
    static Map<String, List<SearchLab.Edge>> adj;
    static String start, goal;

    public static void main(String[] args) {
        input = SearchLab.loadInputMap(args);
        adj = SearchLab.adjacency(input);
        start = SearchLab.start(input);
        goal = SearchLab.goal(input);
        Deque<String> stack = new ArrayDeque<>();
        Set<String> visited = new HashSet<>();
        Map<String, String> parent = new HashMap<>();
        stack.push(start);
        boolean found = false;

        while (!stack.isEmpty()) {
            String current = stack.pop();
            if (visited.contains(current)) {
                continue;
            }
            visited.add(current);
            v.visitNode(current);
            if (current.equals(goal)) {
                found = true;
                break;
            }
            for (SearchLab.Edge edge : adj.get(current)) {
                if (!visited.contains(edge.node)) {
                    parent.put(edge.node, current);
                    stack.push(edge.node);
                    v.traverseEdge(current, edge.node, edge.cost);
                }
            }
        }

        if (found) {
            List<String> path = pathFrom(parent, goal);
            v.markPath(path);
            System.out.println("DFS path: " + String.join(" -> ", path));
        } else {
            System.out.println("Goal not reachable");
        }

        SearchLab.flush();
    }
    static List<String> pathFrom(Map<String, String> parent, String goal) {
        List<String> path = new ArrayList<>();
        String c = goal;
        while (c != null) {
            path.add(0, c);
            c = parent.get(c);
        }
        return path;
    }
}
`,
  },

  {
    id: 'ucs',
    name: 'Uniform Cost Search (UCS)',
    category: 'ai-search',
    target: 'graph',
    timeComplexity: {
      best: 'O(E + V log V)',
      average: 'O(E + V log V)',
      worst: 'O(E + V log V)',
    },
    spaceComplexity: 'O(V)',
    shortDescription: 'Expands the node with the lowest cumulative path cost g(n). Guaranteed optimal for any non-negative edge costs.',
    detailedExplanation: `Uniform Cost Search (UCS) is an optimal uninformed search algorithm for general graphs with non-negative path costs. It operates by maintaining a priority queue ordered strictly by the cumulative path cost g(n) from the start node.

When a node is popped from the priority queue, the cheapest path to that node is guaranteed to have been found.`,
    pseudocode: `function UCS(graph, start, goal):
    pq = PriorityQueue([(0, start, [start])])
    explored = set()

    while pq is not empty:
        cost, node, path = pq.pop_min()

        if node == goal:
            return path, cost

        if node in explored: continue
        explored.add(node)

        for neighbor, edge_cost in graph.neighbors(node):
            if neighbor not in explored:
                pq.push((cost + edge_cost, neighbor, path + [neighbor]))`,
    defaultInput: romaniaMapPreset,
    examplePresets: [
      { name: 'Romania Map (Arad -> Bucharest)', input: romaniaMapPreset },
      { name: 'Simple 6-Node Graph', input: simpleGraphPreset },
    ],
    defaultPythonCode: `
nodes = input["nodes"]
edges = input["edges"]
start = input["startNodeId"]
goal = input["goalNodeId"]

adj = {n["id"]: [] for n in nodes}
for e in edges:
    adj[e["from"]].append((e["to"], e["cost"]))
    if not e["directed"]:
        adj[e["to"]].append((e["from"], e["cost"]))


def reconstruct(parent, start, goal):
    path = []
    node = goal
    while node is not None:
        path.insert(0, node)
        if node == start:
            break
        node = parent.get(node)
    return path

import heapq

pq = [(0, start)]
best = {start: 0}
parent = {}
visited = set()
found = False

while pq:
    cost_so_far, current = heapq.heappop(pq)
    if current in visited:
        continue
    visited.add(current)
    visualizer.visit_node(current)
    visualizer.update_cost(current, cost_so_far)

    if current == goal:
        found = True
        break

    for neighbor, cost in adj[current]:
        new_cost = cost_so_far + cost
        if neighbor not in best or new_cost < best[neighbor]:
            best[neighbor] = new_cost
            parent[neighbor] = current
            heapq.heappush(pq, (new_cost, neighbor))
            visualizer.traverse_edge(current, neighbor, cost)
            visualizer.discover_node(neighbor, new_cost)

if found:
    visualizer.mark_path(reconstruct(parent, start, goal), best[goal])
    print("UCS cost:", best[goal])
else:
    print("Goal not reachable")
`,
    defaultJavaCode: `
import java.util.*;

public class Main {
    static SearchLab.Visualizer v = SearchLab.viz;
    static Map<String, Object> input;
    static Map<String, List<SearchLab.Edge>> adj;
    static String start, goal;

    public static void main(String[] args) {
        input = SearchLab.loadInputMap(args);
        adj = SearchLab.adjacency(input);
        start = SearchLab.start(input);
        goal = SearchLab.goal(input);
        PriorityQueue<Object[]> pq = new PriorityQueue<>(Comparator.comparingDouble(a -> (Double) a[0]));
        pq.add(new Object[]{0.0, start});
        Map<String, Double> best = new HashMap<>();
        best.put(start, 0.0);
        Map<String, String> parent = new HashMap<>();
        Set<String> visited = new HashSet<>();
        boolean found = false;

        while (!pq.isEmpty()) {
            Object[] top = pq.poll();
            double cost = (Double) top[0];
            String current = (String) top[1];
            if (visited.contains(current)) {
                continue;
            }
            visited.add(current);
            v.visitNode(current);
            v.updateCost(current, cost);
            if (current.equals(goal)) {
                found = true;
                break;
            }
            for (SearchLab.Edge edge : adj.get(current)) {
                double newCost = cost + edge.cost;
                if (!best.containsKey(edge.node) || newCost < best.get(edge.node)) {
                    best.put(edge.node, newCost);
                    parent.put(edge.node, current);
                    pq.add(new Object[]{newCost, edge.node});
                    v.traverseEdge(current, edge.node, edge.cost);
                    v.discoverNode(edge.node, newCost);
                }
            }
        }

        if (found) {
            v.markPath(pathFrom(parent, goal), best.get(goal));
            System.out.println("UCS cost: " + best.get(goal));
        } else {
            System.out.println("Goal not reachable");
        }

        SearchLab.flush();
    }
    static List<String> pathFrom(Map<String, String> parent, String goal) {
        List<String> path = new ArrayList<>();
        String c = goal;
        while (c != null) {
            path.add(0, c);
            c = parent.get(c);
        }
        return path;
    }
}
`,
  },

  {
    id: 'dls',
    name: 'Depth-Limited Search (DLS)',
    category: 'ai-search',
    target: 'graph',
    timeComplexity: {
      best: 'O(b^l)',
      average: 'O(b^l)',
      worst: 'O(b^l)',
    },
    spaceComplexity: 'O(b * l)',
    shortDescription: 'Performs DFS with a predetermined maximum depth limit l to prevent infinite loops in deep or infinite state spaces.',
    detailedExplanation: `Depth-Limited Search (DLS) mitigates the risk of DFS becoming trapped down infinite paths or loops by enforcing a cutoff depth limit l. If a solution exists within depth l, it can be found.`,
    pseudocode: `function DLS(node, goal, limit, path):
    if node == goal: return path
    if limit <= 0: return cutoff

    for neighbor in neighbors(node):
        result = DLS(neighbor, goal, limit - 1, path + [neighbor])
        if result != failure: return result`,
    defaultInput: simpleGraphPreset,
    defaultPythonCode: `
nodes = input["nodes"]
edges = input["edges"]
start = input["startNodeId"]
goal = input["goalNodeId"]

adj = {n["id"]: [] for n in nodes}
for e in edges:
    adj[e["from"]].append((e["to"], e["cost"]))
    if not e["directed"]:
        adj[e["to"]].append((e["from"], e["cost"]))


def reconstruct(parent, start, goal):
    path = []
    node = goal
    while node is not None:
        path.insert(0, node)
        if node == start:
            break
        node = parent.get(node)
    return path

LIMIT = 3
parent = {}

def dls(node, depth, visited):
    visualizer.visit_node(node)
    if node == goal:
        return True
    if depth <= 0:
        return False
    for neighbor, cost in adj[node]:
        if neighbor not in visited:
            visited.add(neighbor)
            parent[neighbor] = node
            visualizer.traverse_edge(node, neighbor, cost)
            if dls(neighbor, depth - 1, visited):
                return True
    return False

visited = {start}
found = dls(start, LIMIT, visited)
if found:
    visualizer.mark_path(reconstruct(parent, start, goal))
    print("Found within depth", LIMIT)
else:
    print("Not found within depth", LIMIT)
`,
    defaultJavaCode: `
import java.util.*;

public class Main {
    static SearchLab.Visualizer v = SearchLab.viz;
    static Map<String, Object> input;
    static Map<String, List<SearchLab.Edge>> adj;
    static String start, goal;

    public static void main(String[] args) {
        input = SearchLab.loadInputMap(args);
        adj = SearchLab.adjacency(input);
        start = SearchLab.start(input);
        goal = SearchLab.goal(input);
        Map<String, String> parent = new HashMap<>();
        Set<String> visited = new HashSet<>();
        visited.add(start);
        boolean found = dls(start, 3, visited, parent);
        if (found) {
            v.markPath(pathFrom(parent, goal));
            System.out.println("Found within depth 3");
        } else {
            System.out.println("Not found within depth 3");
        }

        SearchLab.flush();
    }
    static boolean dls(String node, int depth, Set<String> visited, Map<String, String> parent) {
        v.visitNode(node);
        if (node.equals(goal)) {
            return true;
        }
        if (depth <= 0) {
            return false;
        }
        for (SearchLab.Edge edge : adj.get(node)) {
            if (!visited.contains(edge.node)) {
                visited.add(edge.node);
                parent.put(edge.node, node);
                v.traverseEdge(node, edge.node, edge.cost);
                if (dls(edge.node, depth - 1, visited, parent)) {
                    return true;
                }
            }
        }
        return false;
    }

    static List<String> pathFrom(Map<String, String> parent, String goal) {
        List<String> path = new ArrayList<>();
        String c = goal;
        while (c != null) {
            path.add(0, c);
            c = parent.get(c);
        }
        return path;
    }
}
`,
  },

  {
    id: 'iddfs',
    name: 'Iterative Deepening DFS (IDDFS)',
    category: 'ai-search',
    target: 'graph',
    timeComplexity: {
      best: 'O(b^d)',
      average: 'O(b^d)',
      worst: 'O(b^d)',
    },
    spaceComplexity: 'O(b * d)',
    shortDescription: 'Combines the space efficiency of DFS with the completeness and shortest-path guarantees of BFS by repeatedly deepening the limit.',
    detailedExplanation: `Iterative Deepening Depth-First Search (IDDFS) repeatedly runs Depth-Limited Search, gradually increasing the depth limit (limit = 0, 1, 2, ... d) until the goal is found. 
    
It has the optimal O(bd) memory requirement of DFS while enjoying the level-by-level completeness of BFS.`,
    pseudocode: `function IDDFS(start, goal):
    for depth from 0 to max_depth:
        result = DLS(start, goal, depth)
        if result != cutoff:
            return result`,
    defaultInput: simpleGraphPreset,
    defaultPythonCode: `
nodes = input["nodes"]
edges = input["edges"]
start = input["startNodeId"]
goal = input["goalNodeId"]

adj = {n["id"]: [] for n in nodes}
for e in edges:
    adj[e["from"]].append((e["to"], e["cost"]))
    if not e["directed"]:
        adj[e["to"]].append((e["from"], e["cost"]))


def reconstruct(parent, start, goal):
    path = []
    node = goal
    while node is not None:
        path.insert(0, node)
        if node == start:
            break
        node = parent.get(node)
    return path

parent = {}

def dls(node, depth, visited):
    visualizer.visit_node(node)
    if node == goal:
        return True
    if depth <= 0:
        return False
    for neighbor, cost in adj[node]:
        if neighbor not in visited:
            visited.add(neighbor)
            parent[neighbor] = node
            visualizer.traverse_edge(node, neighbor, cost)
            if dls(neighbor, depth - 1, visited):
                return True
    return False

found = False
limit = 0
while limit < 8 and not found:
    visited = {start}
    visualizer.log("Depth limit: " + str(limit))
    if dls(start, limit, visited):
        found = True
        break
    limit += 1

if found:
    visualizer.mark_path(reconstruct(parent, start, goal))
    print("Found at depth limit", limit)
else:
    print("Goal not reachable")
`,
    defaultJavaCode: `
import java.util.*;

public class Main {
    static SearchLab.Visualizer v = SearchLab.viz;
    static Map<String, Object> input;
    static Map<String, List<SearchLab.Edge>> adj;
    static String start, goal;

    public static void main(String[] args) {
        input = SearchLab.loadInputMap(args);
        adj = SearchLab.adjacency(input);
        start = SearchLab.start(input);
        goal = SearchLab.goal(input);
        Map<String, String> parent = new HashMap<>();
        boolean found = false;
        int limit = 0;
        while (limit < 8 && !found) {
            Set<String> visited = new HashSet<>();
            visited.add(start);
            v.log("Depth limit: " + limit);
            if (dls(start, limit, visited, parent)) {
                found = true;
                break;
            }
            limit++;
        }
        if (found) {
            v.markPath(pathFrom(parent, goal));
            System.out.println("Found at depth limit " + limit);
        } else {
            System.out.println("Goal not reachable");
        }

        SearchLab.flush();
    }
    static boolean dls(String node, int depth, Set<String> visited, Map<String, String> parent) {
        v.visitNode(node);
        if (node.equals(goal)) {
            return true;
        }
        if (depth <= 0) {
            return false;
        }
        for (SearchLab.Edge edge : adj.get(node)) {
            if (!visited.contains(edge.node)) {
                visited.add(edge.node);
                parent.put(edge.node, node);
                v.traverseEdge(node, edge.node, edge.cost);
                if (dls(edge.node, depth - 1, visited, parent)) {
                    return true;
                }
            }
        }
        return false;
    }

    static List<String> pathFrom(Map<String, String> parent, String goal) {
        List<String> path = new ArrayList<>();
        String c = goal;
        while (c != null) {
            path.add(0, c);
            c = parent.get(c);
        }
        return path;
    }
}
`,
  },

  {
    id: 'greedy-bfs',
    name: 'Greedy Best-First Search',
    category: 'ai-search',
    target: 'graph',
    isHeuristicRequired: true,
    timeComplexity: {
      best: 'O(b * m)',
      average: 'O(b^m)',
      worst: 'O(b^m)',
    },
    spaceComplexity: 'O(b^m)',
    shortDescription: 'Informed search algorithm that expands the node estimated to be closest to the goal according to the heuristic h(n).',
    detailedExplanation: `Greedy Best-First Search uses an evaluation function f(n) = h(n), where h(n) is an admissible or estimated distance heuristic from node n to the goal.

It prioritizes the node that looks closest to the goal, making it fast in practice, though not always optimal because it ignores cumulative path cost g(n).`,
    pseudocode: `function GreedyBestFirst(graph, start, goal, h):
    pq = PriorityQueue([(h(start), start, [start])])
    visited = set()

    while pq is not empty:
        h_val, node, path = pq.pop_min()
        if node == goal: return path
        visited.add(node)

        for neighbor in graph.neighbors(node):
            if neighbor not in visited:
                pq.push((h(neighbor), neighbor, path + [neighbor]))`,
    defaultInput: romaniaMapPreset,
    defaultPythonCode: `
nodes = input["nodes"]
edges = input["edges"]
start = input["startNodeId"]
goal = input["goalNodeId"]

adj = {n["id"]: [] for n in nodes}
for e in edges:
    adj[e["from"]].append((e["to"], e["cost"]))
    if not e["directed"]:
        adj[e["to"]].append((e["from"], e["cost"]))


def reconstruct(parent, start, goal):
    path = []
    node = goal
    while node is not None:
        path.insert(0, node)
        if node == start:
            break
        node = parent.get(node)
    return path

import heapq

heuristics = {n["id"]: n.get("heuristic", 0) for n in nodes}
pq = [(heuristics.get(start, 0), start)]
visited = {start}
parent = {}
found = False

while pq:
    _, current = heapq.heappop(pq)
    visualizer.visit_node(current)
    if current == goal:
        found = True
        break
    for neighbor, cost in adj[current]:
        if neighbor not in visited:
            visited.add(neighbor)
            parent[neighbor] = current
            heapq.heappush(pq, (heuristics.get(neighbor, 0), neighbor))
            visualizer.traverse_edge(current, neighbor, cost)
            visualizer.discover_node(neighbor, cost)

if found:
    visualizer.mark_path(reconstruct(parent, start, goal))
    print("Greedy path found")
else:
    print("Goal not reachable")
`,
    defaultJavaCode: `
import java.util.*;

public class Main {
    static SearchLab.Visualizer v = SearchLab.viz;
    static Map<String, Object> input;
    static Map<String, List<SearchLab.Edge>> adj;
    static String start, goal;

    public static void main(String[] args) {
        input = SearchLab.loadInputMap(args);
        adj = SearchLab.adjacency(input);
        start = SearchLab.start(input);
        goal = SearchLab.goal(input);
        PriorityQueue<Object[]> pq = new PriorityQueue<>(Comparator.comparingDouble(a -> (Double) a[0]));
        pq.add(new Object[]{SearchLab.heuristic(input, start), start});
        Set<String> visited = new HashSet<>();
        visited.add(start);
        Map<String, String> parent = new HashMap<>();
        boolean found = false;

        while (!pq.isEmpty()) {
            String current = (String) pq.poll()[1];
            v.visitNode(current);
            if (current.equals(goal)) {
                found = true;
                break;
            }
            for (SearchLab.Edge edge : adj.get(current)) {
                if (!visited.contains(edge.node)) {
                    visited.add(edge.node);
                    parent.put(edge.node, current);
                    pq.add(new Object[]{SearchLab.heuristic(input, edge.node), edge.node});
                    v.traverseEdge(current, edge.node, edge.cost);
                    v.discoverNode(edge.node, edge.cost);
                }
            }
        }

        if (found) {
            v.markPath(pathFrom(parent, goal));
            System.out.println("Greedy path found");
        } else {
            System.out.println("Goal not reachable");
        }

        SearchLab.flush();
    }
    static List<String> pathFrom(Map<String, String> parent, String goal) {
        List<String> path = new ArrayList<>();
        String c = goal;
        while (c != null) {
            path.add(0, c);
            c = parent.get(c);
        }
        return path;
    }
}
`,
  },

  {
    id: 'a-star',
    name: 'A* Search Algorithm',
    category: 'ai-search',
    target: 'graph',
    isHeuristicRequired: true,
    timeComplexity: {
      best: 'O(d)',
      average: 'O(b^d)',
      worst: 'O(b^d)',
    },
    spaceComplexity: 'O(b^d)',
    shortDescription: 'Optimal informed search combining past cost g(n) and future estimated cost h(n): f(n) = g(n) + h(n).',
    detailedExplanation: `A* Search is widely considered the industry standard for pathfinding in AI, robotics, and game engines.
    
It evaluates nodes using f(n) = g(n) + h(n):
- g(n): exact cost from start to node n.
- h(n): estimated heuristic cost from node n to goal.

If h(n) is admissible (never overestimates the true remaining cost) and consistent, A* is guaranteed to find the provably optimal shortest path.`,
    pseudocode: `function A_Star(graph, start, goal, h):
    openSet = PriorityQueue([(f(start), start)])
    gScore = {start: 0}
    fScore = {start: h(start)}
    parent = {}

    while openSet is not empty:
        current = openSet.pop_min()
        if current == goal:
            return reconstruct_path(parent, goal)

        for neighbor, weight in graph.neighbors(current):
            tentative_g = gScore[current] + weight
            if tentative_g < gScore[neighbor]:
                parent[neighbor] = current
                gScore[neighbor] = tentative_g
                fScore[neighbor] = tentative_g + h(neighbor)
                openSet.push((fScore[neighbor], neighbor))`,
    defaultInput: romaniaMapPreset,
    examplePresets: [
      { name: 'Romania Map (Arad -> Bucharest)', input: romaniaMapPreset },
      { name: 'Simple 6-Node Graph', input: simpleGraphPreset },
    ],
    defaultPythonCode: `
nodes = input["nodes"]
edges = input["edges"]
start = input["startNodeId"]
goal = input["goalNodeId"]

adj = {n["id"]: [] for n in nodes}
for e in edges:
    adj[e["from"]].append((e["to"], e["cost"]))
    if not e["directed"]:
        adj[e["to"]].append((e["from"], e["cost"]))


def reconstruct(parent, start, goal):
    path = []
    node = goal
    while node is not None:
        path.insert(0, node)
        if node == start:
            break
        node = parent.get(node)
    return path

import heapq

heuristics = {n["id"]: n.get("heuristic", 0) for n in nodes}
pq = [(heuristics.get(start, 0), 0, start)]
best = {start: 0}
parent = {}
visited = set()
found = False

while pq:
    _, g, current = heapq.heappop(pq)
    if current in visited:
        continue
    visited.add(current)
    visualizer.visit_node(current)
    visualizer.update_cost(current, g)
    if current == goal:
        found = True
        break
    for neighbor, cost in adj[current]:
        new_g = g + cost
        if neighbor not in best or new_g < best[neighbor]:
            best[neighbor] = new_g
            parent[neighbor] = current
            f = new_g + heuristics.get(neighbor, 0)
            heapq.heappush(pq, (f, new_g, neighbor))
            visualizer.traverse_edge(current, neighbor, cost)
            visualizer.discover_node(neighbor, new_g)

if found:
    visualizer.mark_path(reconstruct(parent, start, goal), best[goal])
    print("A* cost:", best[goal])
else:
    print("Goal not reachable")
`,
    defaultJavaCode: `
import java.util.*;

public class Main {
    static SearchLab.Visualizer v = SearchLab.viz;
    static Map<String, Object> input;
    static Map<String, List<SearchLab.Edge>> adj;
    static String start, goal;

    public static void main(String[] args) {
        input = SearchLab.loadInputMap(args);
        adj = SearchLab.adjacency(input);
        start = SearchLab.start(input);
        goal = SearchLab.goal(input);
        PriorityQueue<Object[]> pq = new PriorityQueue<>(Comparator.comparingDouble(a -> (Double) a[0]));
        pq.add(new Object[]{SearchLab.heuristic(input, start), 0.0, start});
        Map<String, Double> best = new HashMap<>();
        best.put(start, 0.0);
        Map<String, String> parent = new HashMap<>();
        Set<String> visited = new HashSet<>();
        boolean found = false;

        while (!pq.isEmpty()) {
            Object[] top = pq.poll();
            double g = (Double) top[1];
            String current = (String) top[2];
            if (visited.contains(current)) {
                continue;
            }
            visited.add(current);
            v.visitNode(current);
            v.updateCost(current, g);
            if (current.equals(goal)) {
                found = true;
                break;
            }
            for (SearchLab.Edge edge : adj.get(current)) {
                double newG = g + edge.cost;
                if (!best.containsKey(edge.node) || newG < best.get(edge.node)) {
                    best.put(edge.node, newG);
                    parent.put(edge.node, current);
                    double f = newG + SearchLab.heuristic(input, edge.node);
                    pq.add(new Object[]{f, newG, edge.node});
                    v.traverseEdge(current, edge.node, edge.cost);
                    v.discoverNode(edge.node, newG);
                }
            }
        }

        if (found) {
            v.markPath(pathFrom(parent, goal), best.get(goal));
            System.out.println("A* cost: " + best.get(goal));
        } else {
            System.out.println("Goal not reachable");
        }

        SearchLab.flush();
    }
    static List<String> pathFrom(Map<String, String> parent, String goal) {
        List<String> path = new ArrayList<>();
        String c = goal;
        while (c != null) {
            path.add(0, c);
            c = parent.get(c);
        }
        return path;
    }
}
`,
  },

  // ==========================================
  // GRAPH ALGORITHMS
  // ==========================================
  {
    id: 'dijkstra',
    name: "Dijkstra's Shortest Path",
    category: 'graph',
    target: 'graph',
    timeComplexity: {
      best: 'O(V^2 or (V + E) log V)',
      average: 'O((V + E) log V)',
      worst: 'O((V + E) log V)',
    },
    spaceComplexity: 'O(V)',
    shortDescription: 'Finds the shortest paths between nodes in a graph with non-negative edge costs.',
    detailedExplanation: `Dijkstra's algorithm solves the single-source shortest path problem for graphs with non-negative edge weights. It iteratively relaxes edges, continually extracting the node with minimum tentative distance from a priority queue.`,
    pseudocode: `function Dijkstra(graph, source):
    dist = {v: infinity for v in graph}
    dist[source] = 0
    pq = PriorityQueue([(0, source)])

    while pq is not empty:
        d, u = pq.pop_min()
        if d > dist[u]: continue

        for v, weight in graph.neighbors(u):
            if dist[u] + weight < dist[v]:
                dist[v] = dist[u] + weight
                pq.push((dist[v], v))`,
    defaultInput: simpleGraphPreset,
    defaultPythonCode: `
nodes = input["nodes"]
edges = input["edges"]
start = input["startNodeId"]
goal = input["goalNodeId"]

adj = {n["id"]: [] for n in nodes}
for e in edges:
    adj[e["from"]].append((e["to"], e["cost"]))
    if not e["directed"]:
        adj[e["to"]].append((e["from"], e["cost"]))


def reconstruct(parent, start, goal):
    path = []
    node = goal
    while node is not None:
        path.insert(0, node)
        if node == start:
            break
        node = parent.get(node)
    return path

import heapq

pq = [(0, start)]
best = {start: 0}
parent = {}
visited = set()
found = False

while pq:
    dist, current = heapq.heappop(pq)
    if current in visited:
        continue
    visited.add(current)
    visualizer.visit_node(current)
    visualizer.update_cost(current, dist)
    if current == goal:
        found = True
        break
    for neighbor, cost in adj[current]:
        new_dist = dist + cost
        if neighbor not in best or new_dist < best[neighbor]:
            best[neighbor] = new_dist
            parent[neighbor] = current
            heapq.heappush(pq, (new_dist, neighbor))
            visualizer.traverse_edge(current, neighbor, cost)
            visualizer.discover_node(neighbor, new_dist)

if found:
    visualizer.mark_path(reconstruct(parent, start, goal), best[goal])
    print("Dijkstra cost:", best[goal])
else:
    print("Goal not reachable")
`,
    defaultJavaCode: `
import java.util.*;

public class Main {
    static SearchLab.Visualizer v = SearchLab.viz;
    static Map<String, Object> input;
    static Map<String, List<SearchLab.Edge>> adj;
    static String start, goal;

    public static void main(String[] args) {
        input = SearchLab.loadInputMap(args);
        adj = SearchLab.adjacency(input);
        start = SearchLab.start(input);
        goal = SearchLab.goal(input);
        PriorityQueue<Object[]> pq = new PriorityQueue<>(Comparator.comparingDouble(a -> (Double) a[0]));
        pq.add(new Object[]{0.0, start});
        Map<String, Double> best = new HashMap<>();
        best.put(start, 0.0);
        Map<String, String> parent = new HashMap<>();
        Set<String> visited = new HashSet<>();
        boolean found = false;

        while (!pq.isEmpty()) {
            Object[] top = pq.poll();
            double dist = (Double) top[0];
            String current = (String) top[1];
            if (visited.contains(current)) {
                continue;
            }
            visited.add(current);
            v.visitNode(current);
            v.updateCost(current, dist);
            if (current.equals(goal)) {
                found = true;
                break;
            }
            for (SearchLab.Edge edge : adj.get(current)) {
                double newDist = dist + edge.cost;
                if (!best.containsKey(edge.node) || newDist < best.get(edge.node)) {
                    best.put(edge.node, newDist);
                    parent.put(edge.node, current);
                    pq.add(new Object[]{newDist, edge.node});
                    v.traverseEdge(current, edge.node, edge.cost);
                    v.discoverNode(edge.node, newDist);
                }
            }
        }

        if (found) {
            v.markPath(pathFrom(parent, goal), best.get(goal));
            System.out.println("Dijkstra cost: " + best.get(goal));
        } else {
            System.out.println("Goal not reachable");
        }

        SearchLab.flush();
    }
    static List<String> pathFrom(Map<String, String> parent, String goal) {
        List<String> path = new ArrayList<>();
        String c = goal;
        while (c != null) {
            path.add(0, c);
            c = parent.get(c);
        }
        return path;
    }
}
`,
  },

  {
    id: 'bellman-ford',
    name: 'Bellman-Ford Algorithm',
    category: 'graph',
    target: 'graph',
    timeComplexity: {
      best: 'O(E)',
      average: 'O(V * E)',
      worst: 'O(V * E)',
    },
    spaceComplexity: 'O(V)',
    shortDescription: 'Computes shortest paths from a single source and detects negative weight cycles.',
    detailedExplanation: `The Bellman-Ford algorithm computes single-source shortest paths on graphs with arbitrary (including negative) edge weights. It relaxes all edges |V| - 1 times. A final pass over all edges detects if a negative cycle exists.`,
    pseudocode: `function BellmanFord(nodes, edges, source):
    dist = {v: infinity for v in nodes}
    dist[source] = 0

    for i from 1 to |V| - 1:
        for (u, v, weight) in edges:
            if dist[u] + weight < dist[v]:
                dist[v] = dist[u] + weight

    for (u, v, weight) in edges:
        if dist[u] + weight < dist[v]:
            error "Negative cycle detected!"`,
    defaultInput: dagPreset,
    defaultPythonCode: `
nodes = input["nodes"]
edges = input["edges"]
start = input["startNodeId"]
goal = input["goalNodeId"]

adj = {n["id"]: [] for n in nodes}
for e in edges:
    adj[e["from"]].append((e["to"], e["cost"]))
    if not e["directed"]:
        adj[e["to"]].append((e["from"], e["cost"]))


def reconstruct(parent, start, goal):
    path = []
    node = goal
    while node is not None:
        path.insert(0, node)
        if node == start:
            break
        node = parent.get(node)
    return path

INF = float("inf")
dist = {n["id"]: INF for n in nodes}
dist[start] = 0
parent = {}

for _ in range(len(nodes) - 1):
    updated = False
    for e in edges:
        u, v, w = e["from"], e["to"], e["cost"]
        if dist[u] + w < dist[v]:
            dist[v] = dist[u] + w
            parent[v] = u
            updated = True
            visualizer.traverse_edge(u, v, w)
            visualizer.update_cost(v, dist[v])
        if not e["directed"] and dist[v] + w < dist[u]:
            dist[u] = dist[v] + w
            parent[u] = v
            updated = True
            visualizer.traverse_edge(v, u, w)
            visualizer.update_cost(u, dist[u])
    if not updated:
        break

visualizer.mark_path(reconstruct(parent, start, goal), dist[goal])
print("Bellman-Ford cost:", dist[goal])
`,
    defaultJavaCode: `
import java.util.*;

public class Main {
    static SearchLab.Visualizer v = SearchLab.viz;
    static Map<String, Object> input;
    static Map<String, List<SearchLab.Edge>> adj;
    static String start, goal;

    public static void main(String[] args) {
        input = SearchLab.loadInputMap(args);
        adj = SearchLab.adjacency(input);
        start = SearchLab.start(input);
        goal = SearchLab.goal(input);
        Map<String, Double> dist = new HashMap<>();
        for (Map<String, Object> node : SearchLab.nodesOf(input)) {
            dist.put(String.valueOf(node.get("id")), Double.POSITIVE_INFINITY);
        }
        dist.put(start, 0.0);
        Map<String, String> parent = new HashMap<>();

        for (int i = 0; i < SearchLab.nodesOf(input).size() - 1; i++) {
            boolean updated = false;
            for (Map<String, Object> e : SearchLab.edgesOf(input)) {
                String u = String.valueOf(e.get("from"));
                String w = String.valueOf(e.get("to"));
                double cost = ((Number) e.get("cost")).doubleValue();
                boolean directed = Boolean.TRUE.equals(e.get("directed"));
                if (dist.get(u) + cost < dist.get(w)) {
                    dist.put(w, dist.get(u) + cost);
                    parent.put(w, u);
                    updated = true;
                    v.traverseEdge(u, w, cost);
                    v.updateCost(w, dist.get(w));
                }
                if (!directed && dist.get(w) + cost < dist.get(u)) {
                    dist.put(u, dist.get(w) + cost);
                    parent.put(u, w);
                    updated = true;
                    v.traverseEdge(w, u, cost);
                    v.updateCost(u, dist.get(u));
                }
            }
            if (!updated) {
                break;
            }
        }

        v.markPath(pathFrom(parent, goal), dist.get(goal));
        System.out.println("Bellman-Ford cost: " + dist.get(goal));

        SearchLab.flush();
    }
    static List<String> pathFrom(Map<String, String> parent, String goal) {
        List<String> path = new ArrayList<>();
        String c = goal;
        while (c != null) {
            path.add(0, c);
            c = parent.get(c);
        }
        return path;
    }
}
`,
  },

  {
    id: 'topological-sort',
    name: 'Topological Sort (Kahn’s Algorithm)',
    category: 'graph',
    target: 'graph',
    timeComplexity: {
      best: 'O(V + E)',
      average: 'O(V + E)',
      worst: 'O(V + E)',
    },
    spaceComplexity: 'O(V)',
    shortDescription: 'Produces a linear ordering of vertices in a Directed Acyclic Graph (DAG) using in-degrees.',
    detailedExplanation: `Topological sorting linearly orders vertices of a DAG such that for every directed edge u -> v, u appears before v. Kahn's algorithm works by repeatedly finding nodes with 0 in-degree and removing their outgoing edges.`,
    pseudocode: `function KahnTopologicalSort(graph):
    in_degree = compute_in_degrees(graph)
    queue = [v for v in graph if in_degree[v] == 0]
    order = []

    while queue is not empty:
        u = queue.pop(0)
        order.append(u)
        for v in graph.neighbors(u):
            in_degree[v] -= 1
            if in_degree[v] == 0:
                queue.push(v)
    return order`,
    defaultInput: dagPreset,
    defaultPythonCode: `
nodes = input["nodes"]
edges = input["edges"]
start = input["startNodeId"]
goal = input["goalNodeId"]

adj = {n["id"]: [] for n in nodes}
for e in edges:
    adj[e["from"]].append((e["to"], e["cost"]))
    if not e["directed"]:
        adj[e["to"]].append((e["from"], e["cost"]))


def reconstruct(parent, start, goal):
    path = []
    node = goal
    while node is not None:
        path.insert(0, node)
        if node == start:
            break
        node = parent.get(node)
    return path

in_degree = {n["id"]: 0 for n in nodes}
for e in edges:
    in_degree[e["to"]] += 1

queue = [n for n in in_degree if in_degree[n] == 0]
order = []

while queue:
    node = queue.pop(0)
    order.append(node)
    visualizer.visit_node(node)
    for neighbor, cost in adj[node]:
        if neighbor in in_degree:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

print("Topological order:", " -> ".join(order))
`,
    defaultJavaCode: `
import java.util.*;

public class Main {
    static SearchLab.Visualizer v = SearchLab.viz;
    static Map<String, Object> input;
    static Map<String, List<SearchLab.Edge>> adj;
    static String start, goal;

    public static void main(String[] args) {
        input = SearchLab.loadInputMap(args);
        adj = SearchLab.adjacency(input);
        start = SearchLab.start(input);
        goal = SearchLab.goal(input);
        Map<String, Integer> inDegree = new LinkedHashMap<>();
        for (Map<String, Object> node : SearchLab.nodesOf(input)) {
            inDegree.put(String.valueOf(node.get("id")), 0);
        }
        for (Map<String, Object> e : SearchLab.edgesOf(input)) {
            inDegree.merge(String.valueOf(e.get("to")), 1, Integer::sum);
        }

        LinkedList<String> queue = new LinkedList<>();
        for (Map.Entry<String, Integer> entry : inDegree.entrySet()) {
            if (entry.getValue() == 0) {
                queue.add(entry.getKey());
            }
        }

        List<String> order = new ArrayList<>();
        while (!queue.isEmpty()) {
            String node = queue.poll();
            order.add(node);
            v.visitNode(node);
            for (SearchLab.Edge edge : adj.get(node)) {
                if (inDegree.containsKey(edge.node)) {
                    inDegree.put(edge.node, inDegree.get(edge.node) - 1);
                    if (inDegree.get(edge.node) == 0) {
                        queue.add(edge.node);
                    }
                }
            }
        }

        System.out.println("Topological order: " + String.join(" -> ", order));

        SearchLab.flush();
    }
    static List<String> pathFrom(Map<String, String> parent, String goal) {
        List<String> path = new ArrayList<>();
        String c = goal;
        while (c != null) {
            path.add(0, c);
            c = parent.get(c);
        }
        return path;
    }
}
`,
  },

  {
    id: 'kruskal',
    name: "Kruskal's Minimum Spanning Tree",
    category: 'graph',
    target: 'graph',
    timeComplexity: {
      best: 'O(E log E)',
      average: 'O(E log E)',
      worst: 'O(E log E)',
    },
    spaceComplexity: 'O(V)',
    shortDescription: 'Greedy algorithm that builds a Minimum Spanning Tree (MST) by sorting edges and using Disjoint Set Union (DSU).',
    detailedExplanation: `Kruskal's algorithm finds the Minimum Spanning Tree of a connected, undirected graph. It sorts all edges by weight, then greedily adds edges that do not form a cycle, using a Disjoint Set Union (Union-Find) data structure.`,
    pseudocode: `function Kruskal(nodes, edges):
    sort edges by weight
    dsu = DisjointSet(nodes)
    mst = []

    for (u, v, cost) in edges:
        if dsu.find(u) != dsu.find(v):
            dsu.union(u, v)
            mst.append((u, v))
    return mst`,
    defaultInput: simpleGraphPreset,
    defaultPythonCode: `
nodes = input["nodes"]
edges = input["edges"]
start = input["startNodeId"]
goal = input["goalNodeId"]

adj = {n["id"]: [] for n in nodes}
for e in edges:
    adj[e["from"]].append((e["to"], e["cost"]))
    if not e["directed"]:
        adj[e["to"]].append((e["from"], e["cost"]))


def reconstruct(parent, start, goal):
    path = []
    node = goal
    while node is not None:
        path.insert(0, node)
        if node == start:
            break
        node = parent.get(node)
    return path

parent = {}

def find(x):
    parent.setdefault(x, x)
    root = x
    while parent[root] != root:
        root = parent[root]
    while parent[x] != root:
        parent[x], x = root, parent[x]
    return root

def union(a, b):
    ra, rb = find(a), find(b)
    if ra == rb:
        return False
    parent[rb] = ra
    return True

total = 0
for e in sorted(edges, key=lambda x: x["cost"]):
    visualizer.traverse_edge(e["from"], e["to"], e["cost"])
    if union(e["from"], e["to"]):
        total += e["cost"]
        visualizer.visit_node(e["to"])
        print("Added edge", e["from"], "-", e["to"])

visualizer.log("MST total cost: " + str(total))
print("MST total cost:", total)
`,
    defaultJavaCode: `
import java.util.*;

public class Main {
    static SearchLab.Visualizer v = SearchLab.viz;
    static Map<String, Object> input;
    static Map<String, List<SearchLab.Edge>> adj;
    static String start, goal;

    public static void main(String[] args) {
        input = SearchLab.loadInputMap(args);
        adj = SearchLab.adjacency(input);
        start = SearchLab.start(input);
        goal = SearchLab.goal(input);
        Map<String, String> uf = new HashMap<>();
        List<Map<String, Object>> edges = new ArrayList<>(SearchLab.edgesOf(input));
        edges.sort(Comparator.comparingDouble(e -> ((Number) e.get("cost")).doubleValue()));

        double total = 0;
        for (Map<String, Object> e : edges) {
            String from = String.valueOf(e.get("from"));
            String to = String.valueOf(e.get("to"));
            double cost = ((Number) e.get("cost")).doubleValue();
            v.traverseEdge(from, to, cost);
            if (union(uf, from, to)) {
                total += cost;
                v.visitNode(to);
                System.out.println("Added edge " + from + " - " + to);
            }
        }

        v.log("MST total cost: " + total);
        System.out.println("MST total cost: " + total);

        SearchLab.flush();
    }
    static String find(Map<String, String> parent, String x) {
        parent.putIfAbsent(x, x);
        String root = x;
        while (!parent.get(root).equals(root)) {
            root = parent.get(root);
        }
        while (!parent.get(x).equals(root)) {
            String next = parent.get(x);
            parent.put(x, root);
            x = next;
        }
        return root;
    }

    static boolean union(Map<String, String> parent, String a, String b) {
        String ra = find(parent, a);
        String rb = find(parent, b);
        if (ra.equals(rb)) {
            return false;
        }
        parent.put(rb, ra);
        return true;
    }

    static List<String> pathFrom(Map<String, String> parent, String goal) {
        List<String> path = new ArrayList<>();
        String c = goal;
        while (c != null) {
            path.add(0, c);
            c = parent.get(c);
        }
        return path;
    }
}
`,
  },

  // ==========================================
  // SORTING ALGORITHMS
  // ==========================================
  {
    id: 'bubble-sort',
    name: 'Bubble Sort',
    category: 'sorting',
    target: 'sorting',
    timeComplexity: {
      best: 'O(n)',
      average: 'O(n^2)',
      worst: 'O(n^2)',
    },
    spaceComplexity: 'O(1)',
    shortDescription: 'Repeatedly steps through the list, compares adjacent elements, and swaps them if in the wrong order.',
    detailedExplanation: `Bubble Sort is a simple comparison-based sorting algorithm. In each pass, adjacent elements are compared and swapped if they are in the wrong order, causing larger elements to "bubble up" to the end of the array.`,
    pseudocode: `function BubbleSort(arr):
    n = len(arr)
    for i from 0 to n - 1:
        swapped = false
        for j from 0 to n - i - 2:
            if arr[j] > arr[j + 1]:
                swap(arr[j], arr[j + 1])
                swapped = true
        if not swapped: break`,
    defaultInput: [64, 34, 25, 12, 22, 11, 90, 48],
    examplePresets: [
      { name: 'Default Random', input: [64, 34, 25, 12, 22, 11, 90, 48] },
      { name: 'Nearly Sorted', input: [10, 15, 20, 25, 40, 35, 50, 60] },
      { name: 'Reversed', input: [90, 80, 70, 60, 50, 40, 30, 20, 10] },
      { name: 'Few Unique', input: [25, 10, 25, 50, 10, 50, 25, 10] },
    ],
    defaultPythonCode: `
arr = list(input)
n = len(arr)

for i in range(n - 1):
    for j in range(n - i - 1):
        if visualizer.compare(j, j + 1):
            visualizer.swap(j, j + 1)
            arr[j], arr[j + 1] = arr[j + 1], arr[j]

print("Sorted:", arr)
`,
    defaultJavaCode: `
import java.util.*;

public class Main {
    static SearchLab.Visualizer v = SearchLab.viz;
    static int[] arr;

    public static void main(String[] args) {
        arr = SearchLab.toIntArray(SearchLab.loadInput(args));
        for (int i = 0; i < arr.length - 1; i++) {
            for (int j = 0; j < arr.length - 1 - i; j++) {
                if (v.compare(arr, j, j + 1)) {
                    v.swap(arr, j, j + 1);
                }
            }
        }

        System.out.println("Sorted: " + Arrays.toString(arr));

        SearchLab.flush();
    }
}
`,
  },

  {
    id: 'selection-sort',
    name: 'Selection Sort',
    category: 'sorting',
    target: 'sorting',
    timeComplexity: {
      best: 'O(n^2)',
      average: 'O(n^2)',
      worst: 'O(n^2)',
    },
    spaceComplexity: 'O(1)',
    shortDescription: 'Repeatedly finds the minimum element from the unsorted portion and puts it at the beginning.',
    detailedExplanation: `Selection Sort divides the array into a sorted and an unsorted region. It repeatedly scans the unsorted region to find the minimum element, and swaps it with the first unsorted element.`,
    pseudocode: `function SelectionSort(arr):
    n = len(arr)
    for i from 0 to n - 1:
        min_idx = i
        for j from i + 1 to n - 1:
            if arr[j] < arr[min_idx]:
                min_idx = j
        if min_idx != i:
            swap(arr[i], arr[min_idx])`,
    defaultInput: [29, 10, 14, 37, 13, 85, 42, 19],
    defaultPythonCode: `
arr = list(input)
n = len(arr)

for i in range(n):
    min_idx = i
    for j in range(i + 1, n):
        if visualizer.compare(min_idx, j):
            min_idx = j
    if min_idx != i:
        visualizer.swap(i, min_idx)
        arr[i], arr[min_idx] = arr[min_idx], arr[i]

print("Sorted:", arr)
`,
    defaultJavaCode: `
import java.util.*;

public class Main {
    static SearchLab.Visualizer v = SearchLab.viz;
    static int[] arr;

    public static void main(String[] args) {
        arr = SearchLab.toIntArray(SearchLab.loadInput(args));
        for (int i = 0; i < arr.length; i++) {
            int minIndex = i;
            for (int j = i + 1; j < arr.length; j++) {
                if (v.compare(arr, minIndex, j)) {
                    minIndex = j;
                }
            }
            if (minIndex != i) {
                v.swap(arr, i, minIndex);
            }
        }

        System.out.println("Sorted: " + Arrays.toString(arr));

        SearchLab.flush();
    }
}
`,
  },

  {
    id: 'insertion-sort',
    name: 'Insertion Sort',
    category: 'sorting',
    target: 'sorting',
    timeComplexity: {
      best: 'O(n)',
      average: 'O(n^2)',
      worst: 'O(n^2)',
    },
    spaceComplexity: 'O(1)',
    shortDescription: 'Builds the sorted array one element at a time by inserting each element into its proper position.',
    detailedExplanation: `Insertion Sort works much like sorting playing cards in hand: elements are taken one by one and inserted into their correct relative position among previously sorted elements. Highly efficient for small or nearly sorted arrays.`,
    pseudocode: `function InsertionSort(arr):
    for i from 1 to len(arr) - 1:
        key = arr[i]
        j = i - 1
        while j >= 0 and arr[j] > key:
            arr[j + 1] = arr[j]
            j -= 1
        arr[j + 1] = key`,
    defaultInput: [31, 41, 59, 26, 41, 58, 12, 33],
    defaultPythonCode: `
arr = list(input)

for i in range(1, len(arr)):
    j = i
    while j > 0 and visualizer.compare(j - 1, j):
        visualizer.swap(j - 1, j)
        arr[j - 1], arr[j] = arr[j], arr[j - 1]
        j -= 1

print("Sorted:", arr)
`,
    defaultJavaCode: `
import java.util.*;

public class Main {
    static SearchLab.Visualizer v = SearchLab.viz;
    static int[] arr;

    public static void main(String[] args) {
        arr = SearchLab.toIntArray(SearchLab.loadInput(args));
        for (int i = 1; i < arr.length; i++) {
            int j = i;
            while (j > 0 && v.compare(arr, j - 1, j)) {
                v.swap(arr, j - 1, j);
                j--;
            }
        }

        System.out.println("Sorted: " + Arrays.toString(arr));

        SearchLab.flush();
    }
}
`,
  },

  {
    id: 'quick-sort',
    name: 'Quick Sort',
    category: 'sorting',
    target: 'sorting',
    timeComplexity: {
      best: 'O(n log n)',
      average: 'O(n log n)',
      worst: 'O(n^2)',
    },
    spaceComplexity: 'O(log n)',
    shortDescription: 'Divide-and-conquer algorithm that partitions the array around a chosen pivot element.',
    detailedExplanation: `Quick Sort is one of the most widely used sorting algorithms. It picks a pivot element, partitions the array such that all elements smaller than the pivot precede it and all larger elements follow it, and recursively sorts the sub-arrays.`,
    pseudocode: `function QuickSort(arr, low, high):
    if low < high:
        pi = partition(arr, low, high)
        QuickSort(arr, low, pi - 1)
        QuickSort(arr, pi + 1, high)

function partition(arr, low, high):
    pivot = arr[high]
    i = low - 1
    for j from low to high - 1:
        if arr[j] < pivot:
            i += 1
            swap(arr[i], arr[j])
    swap(arr[i + 1], arr[high])
    return i + 1`,
    defaultInput: [38, 27, 43, 3, 9, 82, 10, 50],
    defaultPythonCode: `
arr = list(input)

def quicksort(lo, hi):
    if lo >= hi:
        return
    visualizer.set_subarray(lo, hi)
    pivot = arr[hi]
    visualizer.set_pivot(hi)
    i = lo
    for j in range(lo, hi):
        if not visualizer.compare(j, hi):
            visualizer.swap(i, j)
            arr[i], arr[j] = arr[j], arr[i]
            i += 1
    visualizer.swap(i, hi)
    arr[i], arr[hi] = arr[hi], arr[i]
    quicksort(lo, i - 1)
    quicksort(i + 1, hi)

quicksort(0, len(arr) - 1)
print("Sorted:", arr)
`,
    defaultJavaCode: `
import java.util.*;

public class Main {
    static SearchLab.Visualizer v = SearchLab.viz;
    static int[] arr;

    public static void main(String[] args) {
        arr = SearchLab.toIntArray(SearchLab.loadInput(args));
        quickSort(arr, 0, arr.length - 1);
        System.out.println("Sorted: " + Arrays.toString(arr));

        SearchLab.flush();
    }
    static void quickSort(int[] a, int lo, int hi) {
        if (lo >= hi) {
            return;
        }
        v.setSubarray(lo, hi);
        v.setPivot(hi);
        int i = lo;
        for (int j = lo; j < hi; j++) {
            if (!v.compare(a, j, hi)) {
                v.swap(a, i, j);
                i++;
            }
        }
        v.swap(a, i, hi);
        quickSort(a, lo, i - 1);
        quickSort(a, i + 1, hi);
    }
}
`,
  },

  {
    id: 'merge-sort',
    name: 'Merge Sort',
    category: 'sorting',
    target: 'sorting',
    timeComplexity: {
      best: 'O(n log n)',
      average: 'O(n log n)',
      worst: 'O(n log n)',
    },
    spaceComplexity: 'O(n)',
    shortDescription: 'Stable divide-and-conquer algorithm that recursively splits the array and merges sorted halves.',
    detailedExplanation: `Merge Sort divides the input array into two halves, recursively sorts them, and then merges the two sorted halves into a single sorted array. Guaranteed O(n log n) runtime across all inputs.`,
    pseudocode: `function MergeSort(arr, l, r):
    if l < r:
        m = (l + r) / 2
        MergeSort(arr, l, m)
        MergeSort(arr, m + 1, r)
        merge(arr, l, m, r)`,
    defaultInput: [45, 12, 85, 32, 89, 39, 69, 44],
    defaultPythonCode: `
arr = list(input)

def merge_sort(lo, hi):
    if lo >= hi:
        return
    mid = (lo + hi) // 2
    visualizer.set_subarray(lo, hi)
    merge_sort(lo, mid)
    merge_sort(mid + 1, hi)

    merged = []
    i, j = lo, mid + 1
    while i <= mid and j <= hi:
        if not visualizer.compare(i, j):
            merged.append(arr[i])
            i += 1
        else:
            merged.append(arr[j])
            j += 1
    while i <= mid:
        merged.append(arr[i])
        i += 1
    while j <= hi:
        merged.append(arr[j])
        j += 1
    for offset, value in enumerate(merged):
        visualizer.write(lo + offset, value)
        arr[lo + offset] = value

merge_sort(0, len(arr) - 1)
print("Sorted:", arr)
`,
    defaultJavaCode: `
import java.util.*;

public class Main {
    static SearchLab.Visualizer v = SearchLab.viz;
    static int[] arr;

    public static void main(String[] args) {
        arr = SearchLab.toIntArray(SearchLab.loadInput(args));
        mergeSort(arr, 0, arr.length - 1);
        System.out.println("Sorted: " + Arrays.toString(arr));

        SearchLab.flush();
    }
    static void mergeSort(int[] a, int lo, int hi) {
        if (lo >= hi) {
            return;
        }
        int mid = (lo + hi) / 2;
        v.setSubarray(lo, hi);
        mergeSort(a, lo, mid);
        mergeSort(a, mid + 1, hi);

        int[] merged = new int[hi - lo + 1];
        int i = lo, j = mid + 1, k = 0;
        while (i <= mid && j <= hi) {
            if (!v.compare(a, i, j)) {
                merged[k++] = a[i++];
            } else {
                merged[k++] = a[j++];
            }
        }
        while (i <= mid) {
            merged[k++] = a[i++];
        }
        while (j <= hi) {
            merged[k++] = a[j++];
        }
        for (int x = 0; x < merged.length; x++) {
            v.write(a, lo + x, merged[x]);
        }
    }
}
`,
  },

  {
    id: 'heap-sort',
    name: 'Heap Sort',
    category: 'sorting',
    target: 'sorting',
    timeComplexity: {
      best: 'O(n log n)',
      average: 'O(n log n)',
      worst: 'O(n log n)',
    },
    spaceComplexity: 'O(1)',
    shortDescription: 'Builds a max-heap from the input data, then repeatedly extracts the maximum element to the end.',
    detailedExplanation: `Heap Sort transforms the array into a Binary Max-Heap. It repeatedly swaps the root (maximum element) with the last unsorted element, reduces the heap size, and calls max-heapify to restore the heap property.`,
    pseudocode: `function HeapSort(arr):
    build_max_heap(arr)
    for i from len(arr) - 1 down to 1:
        swap(arr[0], arr[i])
        max_heapify(arr, 0, i)`,
    defaultInput: [12, 11, 13, 5, 6, 7, 25, 18],
    defaultPythonCode: `
arr = list(input)

def sift_down(i, size):
    largest = i
    left, right = 2 * i + 1, 2 * i + 2
    if left < size and visualizer.compare(left, largest):
        largest = left
    if right < size and visualizer.compare(right, largest):
        largest = right
    if largest != i:
        visualizer.swap(i, largest)
        arr[i], arr[largest] = arr[largest], arr[i]
        sift_down(largest, size)

n = len(arr)
for i in range(n // 2 - 1, -1, -1):
    sift_down(i, n)

for end in range(n - 1, 0, -1):
    visualizer.swap(0, end)
    arr[0], arr[end] = arr[end], arr[0]
    sift_down(0, end)

print("Sorted:", arr)
`,
    defaultJavaCode: `
import java.util.*;

public class Main {
    static SearchLab.Visualizer v = SearchLab.viz;
    static int[] arr;

    public static void main(String[] args) {
        arr = SearchLab.toIntArray(SearchLab.loadInput(args));
        int n = arr.length;
        for (int i = n / 2 - 1; i >= 0; i--) {
            siftDown(arr, i, n);
        }
        for (int end = n - 1; end > 0; end--) {
            v.swap(arr, 0, end);
            siftDown(arr, 0, end);
        }

        System.out.println("Sorted: " + Arrays.toString(arr));

        SearchLab.flush();
    }
    static void siftDown(int[] a, int i, int size) {
        int largest = i;
        int left = 2 * i + 1;
        int right = 2 * i + 2;
        if (left < size && v.compare(a, left, largest)) {
            largest = left;
        }
        if (right < size && v.compare(a, right, largest)) {
            largest = right;
        }
        if (largest != i) {
            v.swap(a, i, largest);
            siftDown(a, largest, size);
        }
    }
}
`,
  },

  // ==========================================
  // TREE ALGORITHMS
  // ==========================================
  {
    id: 'tree-traversal',
    name: 'Binary Tree Traversals (In/Pre/Post/Level)',
    category: 'tree',
    target: 'tree',
    timeComplexity: {
      best: 'O(n)',
      average: 'O(n)',
      worst: 'O(n)',
    },
    spaceComplexity: 'O(h)',
    shortDescription: 'Performs Depth-First (Preorder, Inorder, Postorder) and Breadth-First (Level-Order) tree traversals.',
    detailedExplanation: `Binary tree traversals visit all nodes in a binary tree in a systematic order. 
- Inorder: Left -> Root -> Right (produces sorted order in BSTs)
- Preorder: Root -> Left -> Right
- Postorder: Left -> Right -> Root
- Level-Order: Breadth-first across tree levels`,
    pseudocode: `function Inorder(node):
    if node is not null:
        Inorder(node.left)
        visit(node)
        Inorder(node.right)`,
    defaultInput: {
      id: '1',
      val: 50,
      left: {
        id: '2',
        val: 30,
        left: { id: '4', val: 20 },
        right: { id: '5', val: 40 },
      },
      right: {
        id: '3',
        val: 70,
        left: { id: '6', val: 60 },
        right: { id: '7', val: 80 },
      },
    },
    defaultPythonCode: `
def inorder(node):
    if not node:
        return
    inorder(node.get("left"))
    visualizer.visit_tree_node(node["id"], node["val"])
    inorder(node.get("right"))

print("Inorder traversal")
inorder(input)

print("Level-order traversal")
queue = [input]
while queue:
    curr = queue.pop(0)
    visualizer.visit_tree_node(curr["id"], curr["val"])
    if curr.get("left"):
        queue.append(curr["left"])
    if curr.get("right"):
        queue.append(curr["right"])
`,
    defaultJavaCode: `
import java.util.*;

public class Main {
    static SearchLab.Visualizer v = SearchLab.viz;

    @SuppressWarnings("unchecked")
    static void inorder(Map<String, Object> node) {
        if (node == null) {
            return;
        }
        inorder((Map<String, Object>) node.get("left"));
        v.visitTreeNode(node.get("id"), node.get("val"));
        inorder((Map<String, Object>) node.get("right"));
    }

    @SuppressWarnings("unchecked")
    public static void main(String[] args) {
        Map<String, Object> input = SearchLab.loadInputMap(args);
        System.out.println("Inorder traversal");
        inorder(input);

        System.out.println("Level-order traversal");
        LinkedList<Map<String, Object>> queue = new LinkedList<>();
        queue.add(input);
        while (!queue.isEmpty()) {
            Map<String, Object> curr = queue.poll();
            v.visitTreeNode(curr.get("id"), curr.get("val"));
            Map<String, Object> left = (Map<String, Object>) curr.get("left");
            Map<String, Object> right = (Map<String, Object>) curr.get("right");
            if (left != null) {
                queue.add(left);
            }
            if (right != null) {
                queue.add(right);
            }
        }
        SearchLab.flush();
    }
}
`,
  },

  {
    id: 'bst-operations',
    name: 'Binary Search Tree Operations',
    category: 'tree',
    target: 'tree',
    timeComplexity: {
      best: 'O(log n)',
      average: 'O(log n)',
      worst: 'O(n)',
    },
    spaceComplexity: 'O(n)',
    shortDescription: 'Insert, search, and validate nodes in a Binary Search Tree (BST).',
    detailedExplanation: `A Binary Search Tree satisfies the BST property: for every node, all values in its left subtree are smaller, and all values in its right subtree are larger. This allows O(log n) lookups and insertions.`,
    pseudocode: `function InsertBST(root, val):
    if root is null: return new Node(val)
    if val < root.val: root.left = InsertBST(root.left, val)
    else: root.right = InsertBST(root.right, val)
    return root`,
    defaultInput: [50, 30, 70, 20, 40, 60, 80],
    defaultPythonCode: `
values = list(input)
next_id = [1]

def insert(node, value, parent_id):
    if node is None:
        node_id = str(next_id[0])
        next_id[0] += 1
        visualizer.insert_tree_node(node_id, value, parent_id)
        return {"id": node_id, "val": value, "left": None, "right": None}
    visualizer.visit_tree_node(node["id"], node["val"])
    if value < node["val"]:
        node["left"] = insert(node["left"], value, node["id"])
    else:
        node["right"] = insert(node["right"], value, node["id"])
    return node

root = None
for value in values:
    visualizer.log("Inserting " + str(value))
    root = insert(root, value, None)

print("BST built with", len(values), "nodes")
`,
    defaultJavaCode: `
import java.util.*;

public class Main {
    static SearchLab.Visualizer v = SearchLab.viz;
    static int counter = 1;

    static class Node {
        int value;
        String id;
        Node left, right;

        Node(int value, String id) {
            this.value = value;
            this.id = id;
        }
    }

    static Node insert(Node node, int value, String parentId) {
        if (node == null) {
            String id = String.valueOf(counter++);
            v.insertTreeNode(id, value, parentId);
            return new Node(value, id);
        }
        v.visitTreeNode(node.id, node.value);
        if (value < node.value) {
            node.left = insert(node.left, value, node.id);
        } else {
            node.right = insert(node.right, value, node.id);
        }
        return node;
    }

    public static void main(String[] args) {
        int[] values = SearchLab.toIntArray(SearchLab.loadInput(args));
        Node root = null;
        for (int value : values) {
            v.log("Inserting " + value);
            root = insert(root, value, null);
        }
        System.out.println("BST built with " + values.length + " nodes");
        v.complete();
        SearchLab.flush();
    }
}
`,
  },

  // ==========================================
  // ARRAY SEARCHING & HASH TABLES
  // ==========================================
  {
    id: 'binary-search',
    name: 'Binary Search',
    category: 'searching',
    target: 'sorting',
    timeComplexity: {
      best: 'O(1)',
      average: 'O(log n)',
      worst: 'O(log n)',
    },
    spaceComplexity: 'O(1)',
    shortDescription: 'Efficiently searches a sorted array by repeatedly halving the search interval.',
    detailedExplanation: `Binary Search finds the position of a target value within a sorted array. It compares the target value to the middle element of the array; if unequal, the half in which the target cannot lie is eliminated and the search continues on the remaining half.`,
    pseudocode: `function BinarySearch(arr, target):
    low = 0, high = len(arr) - 1
    while low <= high:
        mid = (low + high) / 2
        if arr[mid] == target: return mid
        else if arr[mid] < target: low = mid + 1
        else: high = mid - 1
    return -1`,
    defaultInput: [2, 5, 8, 12, 16, 23, 38, 56, 72, 91],
    defaultPythonCode: `
arr = list(input)
target = 23

low, high = 0, len(arr) - 1
found_index = -1
visualizer.set_variable("target", target)

while low <= high:
    mid = (low + high) // 2
    visualizer.set_subarray(low, high)
    visualizer.set_pivot(mid)
    if arr[mid] == target:
        found_index = mid
        visualizer.log("Target " + str(target) + " found at index " + str(mid))
        break
    elif arr[mid] < target:
        low = mid + 1
    else:
        high = mid - 1

visualizer.set_variable("foundIndex", found_index)
print("Found index:", found_index)
`,
    defaultJavaCode: `
import java.util.*;

public class Main {
    public static void main(String[] args) {
        SearchLab.Visualizer v = SearchLab.viz;
        int[] arr = SearchLab.toIntArray(SearchLab.loadInput(args));
        int target = 23;
        int low = 0;
        int high = arr.length - 1;
        int foundIndex = -1;
        v.setVariable("target", target);

        while (low <= high) {
            int mid = (low + high) / 2;
            v.setSubarray(low, high);
            v.setPivot(mid);
            if (arr[mid] == target) {
                foundIndex = mid;
                v.log("Target " + target + " found at index " + mid);
                break;
            } else if (arr[mid] < target) {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        v.setVariable("foundIndex", foundIndex);
        System.out.println("Found index: " + foundIndex);
        v.complete();
        SearchLab.flush();
    }
}
`,
  },

  {
    id: 'hash-table',
    name: 'Hash Table (Chaining)',
    category: 'searching',
    target: 'hash-table',
    timeComplexity: {
      best: 'O(1)',
      average: 'O(1)',
      worst: 'O(n)',
    },
    spaceComplexity: 'O(n)',
    shortDescription: 'Demonstrates key hashing, bucket indexing, and collision resolution via separate chaining.',
    detailedExplanation: `A Hash Table uses a hash function to map keys to bucket indices in an array. When multiple keys hash to the same bucket index (collision), separate chaining stores all colliding keys in a linked list or array bucket.`,
    pseudocode: `function HashInsert(table, key, value):
    index = hash(key) % table_size
    bucket = table[index]
    bucket.append((key, value))`,
    defaultInput: ['apple', 'banana', 'orange', 'grape', 'kiwi', 'pear', 'peach', 'plum'],
    defaultPythonCode: `
keys = list(input)
TABLE_SIZE = 7
table = [[] for _ in range(TABLE_SIZE)]

def hash_key(text):
    h = 0
    for ch in text:
        h = (h * 31 + ord(ch)) % TABLE_SIZE
    return h

for key in keys:
    bucket = hash_key(key)
    visualizer.set_variable("currentKey", key)
    visualizer.set_variable("computedBucket", bucket)
    if len(table[bucket]) > 0:
        visualizer.hash_collision(key, bucket)
    table[bucket].append(key)
    visualizer.hash_insert(key, bucket)

visualizer.set_variable("finalHashTable", table)
print("Hash table:", table)
`,
    defaultJavaCode: `
import java.util.*;

public class Main {
    public static void main(String[] args) {
        SearchLab.Visualizer v = SearchLab.viz;
        List<String> keys = SearchLab.toStringList(SearchLab.loadInput(args));
        int tableSize = 7;
        List<List<String>> table = new ArrayList<>();
        for (int i = 0; i < tableSize; i++) {
            table.add(new ArrayList<String>());
        }

        for (String key : keys) {
            int bucket = 0;
            for (int i = 0; i < key.length(); i++) {
                bucket = (bucket * 31 + key.charAt(i)) % tableSize;
            }
            v.setVariable("currentKey", key);
            v.setVariable("computedBucket", bucket);
            if (!table.get(bucket).isEmpty()) {
                v.hashCollision(key, bucket);
            }
            table.get(bucket).add(key);
            v.hashInsert(key, bucket);
        }

        System.out.println("Hash table: " + table);
        v.complete();
        SearchLab.flush();
    }
}
`,
  },
];
