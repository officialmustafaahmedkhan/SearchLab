import { GraphData, GraphEdge, GraphNode } from '../types/graph';

/**
 * Canvas coordinate space used by {@link GraphCanvas}. The SVG uses
 * `viewBox="0 0 900 550"`, so every node must carry absolute coordinates
 * inside this box.
 */
export const CANVAS_WIDTH = 900;
export const CANVAS_HEIGHT = 550;

const PADDING_X = 70;
const PADDING_Y = 60;

type Adjacency = Record<string, string[]>;

/**
 * Assign deterministic `x`/`y` coordinates to any node that lacks them.
 *
 * Uses a simple force-directed simulation (pure TypeScript, no dependency)
 * and then scales the result into the canvas viewBox. Nodes that already have
 * finite coordinates keep them, so extracted graphs that carry real geography
 * (or user-dragged positions) are never disturbed.
 */
export function layoutNodes(
  nodes: GraphNode[],
  edges: GraphEdge[],
): GraphNode[] {
  if (nodes.length === 0) return nodes;

  const needsLayout = nodes.some(
    (node) => !Number.isFinite(node.x) || !Number.isFinite(node.y),
  );
  if (!needsLayout) return nodes;

  const count = nodes.length;

  // Initialise positions on a circle so the simulation is deterministic.
  const positions: Record<string, { x: number; y: number }> = {};
  nodes.forEach((node, index) => {
    const angle = (2 * Math.PI * index) / count;
    positions[node.id] = {
      x: Math.cos(angle) * 250,
      y: Math.sin(angle) * 250,
    };
  });

  // When there are only a handful of nodes a circle already looks tidy.
  if (count > 2) {
    const iterations = 320;
    const repulsion = 90000;
    const springLength = 140;
    const springStrength = 0.02;
    const damping = 0.85;

    for (let step = 0; step < iterations; step += 1) {
      const forces: Record<string, { x: number; y: number }> = {};
      nodes.forEach((node) => {
        forces[node.id] = { x: 0, y: 0 };
      });

      // Repulsion between every pair of nodes.
      for (let i = 0; i < count; i += 1) {
        for (let j = i + 1; j < count; j += 1) {
          const a = nodes[i].id;
          const b = nodes[j].id;
          let dx = positions[a].x - positions[b].x;
          let dy = positions[a].y - positions[b].y;
          let distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 0.01) {
            dx = (i - j) || 1;
            dy = (j - i) || 1;
            distance = Math.sqrt(dx * dx + dy * dy);
          }
          const force = repulsion / (distance * distance);
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          forces[a].x += fx;
          forces[a].y += fy;
          forces[b].x -= fx;
          forces[b].y -= fy;
        }
      }

      // Springs along edges.
      edges.forEach((edge) => {
        if (!positions[edge.from] || !positions[edge.to]) return;
        const dx = positions[edge.to].x - positions[edge.from].x;
        const dy = positions[edge.to].y - positions[edge.from].y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = (distance - springLength) * springStrength;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        forces[edge.from].x += fx;
        forces[edge.from].y += fy;
        forces[edge.to].x -= fx;
        forces[edge.to].y -= fy;
      });

      // Pull gently toward the centre to keep the drawing compact.
      nodes.forEach((node) => {
        forces[node.id].x -= positions[node.id].x * 0.01;
        forces[node.id].y -= positions[node.id].y * 0.01;
      });

      // Integrate.
      nodes.forEach((node) => {
        positions[node.id].x += forces[node.id].x * damping;
        positions[node.id].y += forces[node.id].y * damping;
      });
    }
  }

  // Normalise to the canvas box, preserving aspect ratio.
  const xs = nodes.map((node) => positions[node.id].x);
  const ys = nodes.map((node) => positions[node.id].y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  const usableWidth = CANVAS_WIDTH - PADDING_X * 2;
  const usableHeight = CANVAS_HEIGHT - PADDING_Y * 2;
  const scale = Math.min(usableWidth / spanX, usableHeight / spanY);

  const offsetX = PADDING_X + (usableWidth - spanX * scale) / 2;
  const offsetY = PADDING_Y + (usableHeight - spanY * scale) / 2;

  return nodes.map((node) => {
    const position = positions[node.id];
    return {
      ...node,
      x: Math.round((position.x - minX) * scale + offsetX),
      y: Math.round((position.y - minY) * scale + offsetY),
    };
  });
}

/**
 * Return a copy of `graph` whose nodes all have finite canvas coordinates.
 */
export function withLayout(graph: GraphData): GraphData {
  return {
    ...graph,
    nodes: layoutNodes(graph.nodes, graph.edges),
  };
}

/**
 * Return a copy of `graph` describing how coordinates *will* be produced:
 * every node either keeps its finite `x`/`y` or is marked with `NaN` so the
 * layout pass assigns one. Used to keep validation permissive about geometry.
 */
export function normalizeGraphCoordinates(graph: GraphData): GraphData {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      x: Number.isFinite(node.x) ? node.x : NaN,
      y: Number.isFinite(node.y) ? node.y : NaN,
    })),
  };
}
