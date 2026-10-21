import React from 'react';
import { StateSnapshot } from '../../types/execution';

interface TreeNode {
  id: string | number;
  val: any;
  left?: TreeNode | null;
  right?: TreeNode | null;
}

interface TreeCanvasProps {
  snapshot: StateSnapshot | null;
  initialTree: any;
}

export const TreeCanvas: React.FC<TreeCanvasProps> = ({ snapshot, initialTree }) => {
  const currentEvent = snapshot;
  const visitedNodeId = currentEvent?.dataStructure?.visitedId || currentEvent?.activeNodes?.[0];

  // Helper to layout binary tree nodes in 2D coordinates
  const renderTreeNodes = (
    node: TreeNode | null,
    x: number,
    y: number,
    dx: number
  ): React.ReactNode => {
    if (!node) return null;

    const leftX = x - dx;
    const rightX = x + dx;
    const childY = y + 70;

    const isVisited = String(visitedNodeId) === String(node.id) || String(visitedNodeId) === String(node.val);

    return (
      <g key={node.id}>
        {/* Branch lines */}
        {node.left && (
          <line
            x1={x}
            y1={y}
            x2={leftX}
            y2={childY}
            stroke="#475569"
            strokeWidth="2"
          />
        )}
        {node.right && (
          <line
            x1={x}
            y1={y}
            x2={rightX}
            y2={childY}
            stroke="#475569"
            strokeWidth="2"
          />
        )}

        {/* Child recursion */}
        {node.left && renderTreeNodes(node.left, leftX, childY, dx * 0.52)}
        {node.right && renderTreeNodes(node.right, rightX, childY, dx * 0.52)}

        {/* Current Node Circle */}
        <circle
          cx={x}
          cy={y}
          r="22"
          fill={isVisited ? '#0284c7' : '#1e293b'}
          stroke={isVisited ? '#38bdf8' : '#64748b'}
          strokeWidth={isVisited ? 3.5 : 2}
        />
        <text
          x={x}
          y={y + 5}
          textAnchor="middle"
          fill="#f8fafc"
          fontSize="14"
          fontWeight="bold"
        >
          {node.val}
        </text>
      </g>
    );
  };

  const treeRoot: TreeNode =
    snapshot && snapshot.dataStructure && snapshot.dataStructure.id
      ? snapshot.dataStructure
      : initialTree;

  return (
    <div className="tree-visualizer-container">
      <svg className="tree-canvas" viewBox="0 0 800 400">
        <defs>
          <filter id="tree-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        {renderTreeNodes(treeRoot, 400, 50, 160)}
      </svg>
    </div>
  );
};
