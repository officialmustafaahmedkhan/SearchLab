export interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  heuristic?: number; // h(n) for greedy & A*
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  cost: number;
  directed: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  startNodeId: string;
  goalNodeId: string;
}

export interface AdjacencyNeighbor {
  node: string;
  cost: number;
}

export type AdjacencyList = Record<string, AdjacencyNeighbor[]>;

export function graphDataToAdjacency(data: GraphData): AdjacencyList {
  const adj: AdjacencyList = {};
  data.nodes.forEach((n) => {
    adj[n.id] = [];
  });
  data.edges.forEach((e) => {
    if (!adj[e.from]) adj[e.from] = [];
    adj[e.from].push({ node: e.to, cost: e.cost });
    if (!e.directed) {
      if (!adj[e.to]) adj[e.to] = [];
      adj[e.to].push({ node: e.from, cost: e.cost });
    }
  });
  return adj;
}
