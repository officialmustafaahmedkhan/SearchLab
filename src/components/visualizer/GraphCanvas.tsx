import React, { useState, useRef } from 'react';
import { GraphData, GraphNode, GraphEdge } from '../../types/graph';
import { StateSnapshot } from '../../types/execution';
import { Trash2, Crosshair, Star, Edit3 } from 'lucide-react';

interface GraphCanvasProps {
  graphData: GraphData;
  snapshot: StateSnapshot | null;
  onUpdateGraph: (updated: GraphData) => void;
  isEditable?: boolean;
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  graphData,
  snapshot,
  onUpdateGraph,
  isEditable = true,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [edgeSourceNodeId, setEdgeSourceNodeId] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<{ id: string; label: string; heuristic: number } | null>(null);
  const [editingEdge, setEditingEdge] = useState<{ id: string; cost: number } | null>(null);

  // Active state derived from snapshot
  const activeNodes = snapshot?.activeNodes || [];
  const visitedNodes = snapshot?.visitedNodes || [];
  const activeEdges = snapshot?.activeEdges || [];
  const finalPath = snapshot?.finalPath || [];
  const nodeCosts = snapshot?.variables?.costs || snapshot?.variables?.distances || {};

  // Check if edge is in final path
  const isEdgeInFinalPath = (u: string, v: string) => {
    if (finalPath.length < 2) return false;
    for (let i = 0; i < finalPath.length - 1; i++) {
      if (
        (finalPath[i] === u && finalPath[i + 1] === v) ||
        (finalPath[i] === v && finalPath[i + 1] === u)
      ) {
        return true;
      }
    }
    return false;
  };

  // Check if edge is currently active
  const isEdgeActive = (u: string, v: string) => {
    return activeEdges.some(
      ([a, b]) => (a === u && b === v) || (a === v && b === u)
    );
  };

  // Node Dragging
  const handleMouseDownNode = (e: React.MouseEvent, node: GraphNode) => {
    e.stopPropagation();
    if (edgeSourceNodeId) {
      if (edgeSourceNodeId !== node.id) {
        // Create new edge
        const newEdge: GraphEdge = {
          id: `e_${Date.now()}`,
          from: edgeSourceNodeId,
          to: node.id,
          cost: 1,
          directed: false,
        };
        onUpdateGraph({
          ...graphData,
          edges: [...graphData.edges, newEdge],
        });
      }
      setEdgeSourceNodeId(null);
      return;
    }

    setSelectedNodeId(node.id);
    setDragNodeId(node.id);
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (svgRect) {
      setDragOffset({
        x: e.clientX - svgRect.left - node.x,
        y: e.clientY - svgRect.top - node.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragNodeId || !svgRef.current) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    const newX = Math.round(e.clientX - svgRect.left - dragOffset.x);
    const newY = Math.round(e.clientY - svgRect.top - dragOffset.y);

    onUpdateGraph({
      ...graphData,
      nodes: graphData.nodes.map((n) =>
        n.id === dragNodeId
          ? { ...n, x: Math.max(30, Math.min(850, newX)), y: Math.max(30, Math.min(520, newY)) }
          : n
      ),
    });
  };

  const handleMouseUp = () => {
    setDragNodeId(null);
  };

  // Add new node at canvas click
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (edgeSourceNodeId) {
      setEdgeSourceNodeId(null);
      return;
    }
    if (!isEditable) return;
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;

    const x = Math.round(e.clientX - svgRect.left);
    const y = Math.round(e.clientY - svgRect.top);

    // Generate unique node label
    const nextCharCode = 65 + graphData.nodes.length;
    const id = nextCharCode <= 90 ? String.fromCharCode(nextCharCode) : `N${graphData.nodes.length + 1}`;
    
    const newNode: GraphNode = {
      id,
      label: id,
      x,
      y,
      heuristic: 0,
    };

    onUpdateGraph({
      ...graphData,
      nodes: [...graphData.nodes, newNode],
    });
    setSelectedNodeId(id);
  };

  const handleDeleteSelected = () => {
    if (!selectedNodeId) return;
    onUpdateGraph({
      ...graphData,
      nodes: graphData.nodes.filter((n) => n.id !== selectedNodeId),
      edges: graphData.edges.filter(
        (e) => e.from !== selectedNodeId && e.to !== selectedNodeId
      ),
      startNodeId: graphData.startNodeId === selectedNodeId ? (graphData.nodes[0]?.id || '') : graphData.startNodeId,
      goalNodeId: graphData.goalNodeId === selectedNodeId ? (graphData.nodes[1]?.id || '') : graphData.goalNodeId,
    });
    setSelectedNodeId(null);
  };

  const handleSetStart = () => {
    if (!selectedNodeId) return;
    onUpdateGraph({ ...graphData, startNodeId: selectedNodeId });
  };

  const handleSetGoal = () => {
    if (!selectedNodeId) return;
    onUpdateGraph({ ...graphData, goalNodeId: selectedNodeId });
  };

  const selectedNode = graphData.nodes.find((n) => n.id === selectedNodeId);

  return (
    <div className="graph-visualizer-container">
      {/* Editor Overlay Toolbar */}
      {isEditable && (
        <div className="graph-toolbar">
          <div className="graph-toolbar-group">
            <span className="toolbar-hint">
              {edgeSourceNodeId ? (
                <span className="connecting-mode">
                  Click another node to connect from <strong>{edgeSourceNodeId}</strong>
                </span>
              ) : (
                'Click canvas to add node • Drag to move'
              )}
            </span>
          </div>

          {selectedNode && (
            <div className="graph-toolbar-actions">
              <span className="selected-tag">Node: {selectedNode.label}</span>
              <button
                className={`btn btn-sm ${graphData.startNodeId === selectedNode.id ? 'btn-active-start' : 'btn-subtle'}`}
                onClick={handleSetStart}
                title="Set as Start Node"
              >
                <Crosshair size={14} /> Start
              </button>
              <button
                className={`btn btn-sm ${graphData.goalNodeId === selectedNode.id ? 'btn-active-goal' : 'btn-subtle'}`}
                onClick={handleSetGoal}
                title="Set as Goal Node"
              >
                <Star size={14} /> Goal
              </button>
              <button
                className={`btn btn-sm ${edgeSourceNodeId === selectedNode.id ? 'btn-active' : 'btn-subtle'}`}
                onClick={() => setEdgeSourceNodeId(edgeSourceNodeId === selectedNode.id ? null : selectedNode.id)}
                title="Connect Edge"
              >
                Connect
              </button>
              <button
                className="btn btn-sm btn-subtle"
                onClick={() => setEditingNode({ id: selectedNode.id, label: selectedNode.label, heuristic: selectedNode.heuristic || 0 })}
                title="Edit Heuristic / Name"
              >
                <Edit3 size={14} /> Edit
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={handleDeleteSelected}
                title="Delete Node"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* SVG Interactive Canvas */}
      <svg
        ref={svgRef}
        className="graph-canvas"
        viewBox="0 0 900 550"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleCanvasClick}
      >
        <defs>
          {/* Arrowhead marker for directed edges */}
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="22"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
          </marker>
          <marker
            id="arrowhead-active"
            markerWidth="10"
            markerHeight="7"
            refX="22"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#38bdf8" />
          </marker>
          <marker
            id="arrowhead-path"
            markerWidth="10"
            markerHeight="7"
            refX="22"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#f59e0b" />
          </marker>
          {/* Glow filter */}
          <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Edges */}
        <g className="edges-layer">
          {graphData.edges.map((edge) => {
            const u = graphData.nodes.find((n) => n.id === edge.from);
            const v = graphData.nodes.find((n) => n.id === edge.to);
            if (!u || !v) return null;

            const inFinalPath = isEdgeInFinalPath(edge.from, edge.to);
            const isActive = isEdgeActive(edge.from, edge.to);

            let strokeColor = '#475569';
            let strokeWidth = 2;
            let marker = edge.directed ? 'url(#arrowhead)' : undefined;

            if (inFinalPath) {
              strokeColor = '#f59e0b';
              strokeWidth = 4;
              marker = edge.directed ? 'url(#arrowhead-path)' : undefined;
            } else if (isActive) {
              strokeColor = '#38bdf8';
              strokeWidth = 3.5;
              marker = edge.directed ? 'url(#arrowhead-active)' : undefined;
            }

            const midX = (u.x + v.x) / 2;
            const midY = (u.y + v.y) / 2;

            return (
              <g key={edge.id} className="edge-group">
                <line
                  x1={u.x}
                  y1={u.y}
                  x2={v.x}
                  y2={v.y}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  markerEnd={marker}
                  className={`graph-edge ${isActive ? 'edge-active' : ''} ${inFinalPath ? 'edge-path' : ''}`}
                />
                {/* Edge Cost Badge */}
                {edge.cost !== undefined && (
                  <g
                    transform={`translate(${midX}, ${midY})`}
                    className="edge-cost-badge"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingEdge({ id: edge.id, cost: edge.cost });
                    }}
                  >
                    <rect
                      x="-14"
                      y="-10"
                      width="28"
                      height="20"
                      rx="4"
                      fill="#1e293b"
                      stroke={isActive ? '#38bdf8' : inFinalPath ? '#f59e0b' : '#334155'}
                      strokeWidth="1.5"
                    />
                    <text
                      textAnchor="middle"
                      dy="4"
                      fill="#e2e8f0"
                      fontSize="11"
                      fontWeight="600"
                    >
                      {edge.cost}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* Nodes */}
        <g className="nodes-layer">
          {graphData.nodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isStart = graphData.startNodeId === node.id;
            const isGoal = graphData.goalNodeId === node.id;
            const isActive = activeNodes.includes(node.id);
            const isVisited = visitedNodes.includes(node.id);
            const isInPath = finalPath.includes(node.id);
            const cost = nodeCosts[node.id];

            let fillColor = '#1e293b';
            let strokeColor = '#64748b';
            let strokeWidth = 2;

            if (isInPath) {
              fillColor = '#78350f';
              strokeColor = '#f59e0b';
              strokeWidth = 3.5;
            } else if (isActive) {
              fillColor = '#0369a1';
              strokeColor = '#38bdf8';
              strokeWidth = 4;
            } else if (isVisited) {
              fillColor = '#064e3b';
              strokeColor = '#10b981';
              strokeWidth = 2.5;
            } else if (isStart) {
              strokeColor = '#22c55e';
              strokeWidth = 3;
            } else if (isGoal) {
              strokeColor = '#ef4444';
              strokeWidth = 3;
            }

            if (isSelected) {
              strokeColor = '#a855f7';
              strokeWidth = 3.5;
            }

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                className={`node-group ${isActive ? 'node-active' : ''}`}
                onMouseDown={(e) => handleMouseDownNode(e, node)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingNode({ id: node.id, label: node.label, heuristic: node.heuristic || 0 });
                }}
              >
                {/* Active glow pulse */}
                {isActive && (
                  <circle
                    r="28"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2"
                    opacity="0.6"
                    className="pulse-ring"
                  />
                )}

                {/* Main Node Circle */}
                <circle
                  r="20"
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  filter={isActive || isInPath ? 'url(#node-glow)' : undefined}
                />

                {/* Node Label */}
                <text
                  textAnchor="middle"
                  dy="5"
                  fill="#f8fafc"
                  fontSize="13"
                  fontWeight="700"
                  pointerEvents="none"
                >
                  {node.label}
                </text>

                {/* Start / Goal Badges */}
                {isStart && (
                  <g transform="translate(0, -28)">
                    <rect x="-18" y="-9" width="36" height="16" rx="4" fill="#22c55e" />
                    <text textAnchor="middle" dy="3" fill="#0f172a" fontSize="9" fontWeight="800">
                      START
                    </text>
                  </g>
                )}
                {isGoal && (
                  <g transform="translate(0, -28)">
                    <rect x="-18" y="-9" width="36" height="16" rx="4" fill="#ef4444" />
                    <text textAnchor="middle" dy="3" fill="#ffffff" fontSize="9" fontWeight="800">
                      GOAL
                    </text>
                  </g>
                )}

                {/* Cost Pill g(n) */}
                {cost !== undefined && cost !== Infinity && (
                  <g transform="translate(0, 29)">
                    <rect x="-20" y="-8" width="40" height="16" rx="4" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" />
                    <text textAnchor="middle" dy="4" fill="#38bdf8" fontSize="10" fontWeight="700">
                      g={cost}
                    </text>
                  </g>
                )}

                {/* Heuristic Pill h(n) */}
                {node.heuristic !== undefined && node.heuristic > 0 && cost === undefined && (
                  <g transform="translate(0, 29)">
                    <rect x="-20" y="-8" width="40" height="16" rx="4" fill="#0f172a" stroke="#a855f7" strokeWidth="1" />
                    <text textAnchor="middle" dy="4" fill="#c084fc" fontSize="10" fontWeight="700">
                      h={node.heuristic}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Edit Node Modal */}
      {editingNode && (
        <div className="mini-modal-backdrop" onClick={() => setEditingNode(null)}>
          <div className="mini-modal" onClick={(e) => e.stopPropagation()}>
            <h4>Edit Node: {editingNode.id}</h4>
            <div className="form-group">
              <label>Node Label:</label>
              <input
                type="text"
                value={editingNode.label}
                onChange={(e) => setEditingNode({ ...editingNode, label: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Heuristic h(n) to Goal:</label>
              <input
                type="number"
                value={editingNode.heuristic}
                onChange={(e) => setEditingNode({ ...editingNode, heuristic: Number(e.target.value) })}
              />
            </div>
            <div className="mini-modal-buttons">
              <button
                className="btn btn-sm btn-subtle"
                onClick={() => setEditingNode(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => {
                  onUpdateGraph({
                    ...graphData,
                    nodes: graphData.nodes.map((n) =>
                      n.id === editingNode.id
                        ? { ...n, label: editingNode.label, heuristic: editingNode.heuristic }
                        : n
                    ),
                  });
                  setEditingNode(null);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Edge Cost Modal */}
      {editingEdge && (
        <div className="mini-modal-backdrop" onClick={() => setEditingEdge(null)}>
          <div className="mini-modal" onClick={(e) => e.stopPropagation()}>
            <h4>Edit Edge Weight</h4>
            <div className="form-group">
              <label>Edge Cost:</label>
              <input
                type="number"
                value={editingEdge.cost}
                onChange={(e) => setEditingEdge({ ...editingEdge, cost: Number(e.target.value) })}
              />
            </div>
            <div className="mini-modal-buttons">
              <button
                className="btn btn-sm btn-danger"
                onClick={() => {
                  onUpdateGraph({
                    ...graphData,
                    edges: graphData.edges.filter((e) => e.id !== editingEdge.id),
                  });
                  setEditingEdge(null);
                }}
              >
                Delete Edge
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => {
                  onUpdateGraph({
                    ...graphData,
                    edges: graphData.edges.map((e) =>
                      e.id === editingEdge.id ? { ...e, cost: editingEdge.cost } : e
                    ),
                  });
                  setEditingEdge(null);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
