import React from 'react';
import { StateSnapshot } from '../../types/execution';

interface SortingBarsProps {
  snapshot: StateSnapshot | null;
  initialArray: number[];
}

export const SortingBars: React.FC<SortingBarsProps> = ({ snapshot, initialArray }) => {
  // Use array state from snapshot if available, else initialArray
  const currentArray: number[] =
    snapshot && Array.isArray(snapshot.dataStructure)
      ? snapshot.dataStructure
      : initialArray;

  const activeIndices = snapshot?.activeIndices || [];
  const secondaryIndices = snapshot?.secondaryIndices || []; // Pivot
  const metrics = snapshot?.metrics || { comparisons: 0, swaps: 0, writes: 0 };

  const maxVal = Math.max(...currentArray, 100);

  return (
    <div className="sorting-visualizer-container">
      {/* Live Operation Stats Header */}
      <div className="sorting-metrics-bar">
        <div className="stat-pill">
          <span className="stat-label">Comparisons</span>
          <span className="stat-value text-amber">{metrics.comparisons}</span>
        </div>
        <div className="stat-pill">
          <span className="stat-label">Swaps</span>
          <span className="stat-value text-rose">{metrics.swaps}</span>
        </div>
        <div className="stat-pill">
          <span className="stat-label">Writes</span>
          <span className="stat-value text-purple">{metrics.writes}</span>
        </div>
        <div className="stat-pill">
          <span className="stat-label">Elements</span>
          <span className="stat-value">{currentArray.length}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="sorting-legend">
        <div className="legend-item">
          <span className="legend-dot bg-amber" /> Compare
        </div>
        <div className="legend-item">
          <span className="legend-dot bg-rose" /> Swap
        </div>
        <div className="legend-item">
          <span className="legend-dot bg-cyan" /> Pivot
        </div>
        <div className="legend-item">
          <span className="legend-dot bg-emerald" /> In Position
        </div>
      </div>

      {/* Bar Chart Container */}
      <div className="bars-stage">
        {currentArray.map((val, idx) => {
          const isActive = activeIndices.includes(idx);
          const isPivot = secondaryIndices.includes(idx);
          const heightPercent = Math.max(10, Math.round((val / maxVal) * 100));

          let barClass = 'bar-default';
          if (isPivot) {
            barClass = 'bar-pivot';
          } else if (isActive) {
            // If comparisons occurred, highlight as compared / swapped
            barClass = metrics.swaps > 0 ? 'bar-swapped' : 'bar-compared';
          }

          return (
            <div key={idx} className="bar-column">
              <span className="bar-value">{val}</span>
              <div
                className={`bar ${barClass}`}
                style={{ height: `${heightPercent}%` }}
              >
                <div className="bar-glow" />
              </div>
              <span className="bar-index">[{idx}]</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
