import React, { useMemo } from 'react';
import { AlgorithmDefinition } from '../../types/algorithms';
import { StateSnapshot } from '../../types/execution';
import { GraphData } from '../../types/graph';
import { GraphCanvas } from './GraphCanvas';
import { SortingBars } from './SortingBars';
import { TreeCanvas } from './TreeCanvas';
import { HashTableView } from './HashTableView';
import { Shuffle, RotateCcw, SlidersHorizontal, Wand2, Loader2 } from 'lucide-react';
import { layoutNodes } from '../../utils/graphLayout';

interface VisualizerContainerProps {
  algorithm: AlgorithmDefinition;
  snapshot: StateSnapshot | null;
  currentInput: any;
  onUpdateInput: (newInput: any) => void;
  isRunning: boolean;
  /** Redesign the canvas from a graph defined in the editor code. */
  onExtractFromCode?: () => void;
  isExtracting?: boolean;
}

export const VisualizerContainer: React.FC<VisualizerContainerProps> = ({
  algorithm,
  snapshot,
  currentInput,
  onUpdateInput,
  isRunning,
  onExtractFromCode,
  isExtracting = false,
}) => {
  // Quick array reshuffle helper for sorting/array search
  const handleRandomizeArray = () => {
    const size = Array.isArray(currentInput) ? currentInput.length : 8;
    const newArr = Array.from({ length: size }, () => Math.floor(Math.random() * 88) + 10);
    onUpdateInput(newArr);
  };

  const handleReverseArray = () => {
    if (Array.isArray(currentInput)) {
      onUpdateInput([...currentInput].sort((a, b) => b - a));
    }
  };

  const handleNearlySortedArray = () => {
    if (Array.isArray(currentInput)) {
      const sorted = [...currentInput].sort((a, b) => a - b);
      if (sorted.length > 3) {
        // Swap one pair
        const temp = sorted[2];
        sorted[2] = sorted[3];
        sorted[3] = temp;
      }
      onUpdateInput(sorted);
    }
  };

  // Never crash the canvas: fall back to a small default graph if the input is
  // missing or malformed, and assign coordinates to any nodes that lack them.
  const safeGraph: GraphData = useMemo(() => {
    const candidate = currentInput as GraphData;
    if (!candidate || !Array.isArray(candidate.nodes)) {
      return { nodes: [], edges: [], startNodeId: '', goalNodeId: '' };
    }
    return {
      ...candidate,
      edges: Array.isArray(candidate.edges) ? candidate.edges : [],
      nodes: layoutNodes(candidate.nodes, Array.isArray(candidate.edges) ? candidate.edges : []),
    };
  }, [currentInput]);

  return (
    <div className="visualizer-main-wrapper">
      {/* Top Visualizer Canvas Header / Input Controls */}
      <div className="visualizer-header-bar">
        <div className="visualizer-title-area">
          <span className="visualizer-view-label">Interactive Visualization Canvas</span>
          <span className="visualizer-target-badge">{algorithm.target.toUpperCase()}</span>
        </div>

        {/* Graph quick actions: rebuild the canvas from the editor code */}
        {algorithm.target === 'graph' && onExtractFromCode && (
          <div className="visualizer-quick-actions">
            <button
              className="btn btn-xs btn-subtle"
              onClick={onExtractFromCode}
              disabled={isExtracting}
              title="Scan the code in the editor and rebuild the canvas from the graph it defines"
            >
              {isExtracting ? (
                <Loader2 size={12} className="spin" />
              ) : (
                <Wand2 size={12} />
              )}
              {isExtracting ? 'Scanning…' : 'Use Graph from Code'}
            </button>
          </div>
        )}

        {/* Sorting Custom Quick Actions */}
        {algorithm.target === 'sorting' && (
          <div className="visualizer-quick-actions">
            <button
              className="btn btn-xs btn-subtle"
              onClick={handleRandomizeArray}
              title="Generate Random Array"
            >
              <Shuffle size={12} /> Randomize
            </button>
            <button
              className="btn btn-xs btn-subtle"
              onClick={handleReverseArray}
              title="Reverse Array"
            >
              <RotateCcw size={12} /> Reversed
            </button>
            <button
              className="btn btn-xs btn-subtle"
              onClick={handleNearlySortedArray}
              title="Nearly Sorted Array"
            >
              <SlidersHorizontal size={12} /> Nearly Sorted
            </button>
          </div>
        )}
      </div>

      {/* Main Visual Stage */}
      <div className="visualizer-canvas-viewport">
        {algorithm.target === 'graph' && (
          <GraphCanvas
            graphData={safeGraph}
            snapshot={snapshot}
            onUpdateGraph={onUpdateInput}
            isEditable={!isRunning}
          />
        )}

        {algorithm.target === 'sorting' && (
          <SortingBars
            snapshot={snapshot}
            initialArray={Array.isArray(currentInput) ? currentInput : [50, 20, 80, 10, 30]}
          />
        )}

        {algorithm.target === 'tree' && (
          <TreeCanvas
            snapshot={snapshot}
            initialTree={currentInput}
          />
        )}

        {algorithm.target === 'hash-table' && (
          <HashTableView
            snapshot={snapshot}
            keys={Array.isArray(currentInput) ? currentInput : []}
          />
        )}
      </div>
    </div>
  );
};
