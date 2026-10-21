import React, { useState } from 'react';
import { Terminal, AlertCircle, Cpu, Clock, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { ExecutionMetrics } from '../../types/execution';

interface ConsoleBottomPanelProps {
  logs: string[];
  error?: {
    message: string;
    line?: number;
    column?: number;
    stack?: string;
  };
  metrics?: ExecutionMetrics;
  onJumpToLine?: (line: number) => void;
  onClearLogs?: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const ConsoleBottomPanel: React.FC<ConsoleBottomPanelProps> = ({
  logs,
  error,
  metrics,
  onJumpToLine,
  onClearLogs,
  isCollapsed,
  onToggleCollapse,
}) => {
  const [activeTab, setActiveTab] = useState<'console' | 'metrics'>('console');

  return (
    <div className={`bottom-console-panel ${isCollapsed ? 'is-collapsed' : ''}`}>
      {/* Console Header Bar */}
      <div className="console-header" onClick={onToggleCollapse}>
        <div className="console-tabs" onClick={(e) => e.stopPropagation()}>
          <button
            className={`console-tab ${activeTab === 'console' ? 'active' : ''}`}
            onClick={() => setActiveTab('console')}
          >
            <Terminal size={14} />
            <span>Console & Terminal</span>
            {error && <span className="error-count-dot">1</span>}
          </button>
          <button
            className={`console-tab ${activeTab === 'metrics' ? 'active' : ''}`}
            onClick={() => setActiveTab('metrics')}
          >
            <Cpu size={14} />
            <span>Complexity & Performance</span>
          </button>
        </div>

        <div className="console-header-actions" onClick={(e) => e.stopPropagation()}>
          {onClearLogs && (
            <button className="console-btn" onClick={onClearLogs} title="Clear Console">
              <Trash2 size={13} />
            </button>
          )}
          <button className="console-btn" onClick={onToggleCollapse} title="Collapse Panel">
            {isCollapsed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Console Content */}
      {!isCollapsed && (
        <div className="console-body">
          {activeTab === 'console' && (
            <div className="console-terminal-view">
              {/* Error banner if runtime error */}
              {error && (
                <div
                  className="terminal-error-card"
                  onClick={() => error.line && onJumpToLine && onJumpToLine(error.line)}
                >
                  <AlertCircle size={16} className="text-rose" />
                  <div className="error-body">
                    <div className="error-title">
                      Runtime Error: {error.message}
                      {error.line && <span className="error-line-badge">Line {error.line}</span>}
                    </div>
                    {error.stack && <pre className="error-stack">{error.stack}</pre>}
                  </div>
                </div>
              )}

              {logs.length === 0 && !error ? (
                <div className="console-empty">Console is ready. Program output will appear here.</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="console-line">
                    <span className="line-prefix">❯</span>
                    <span className="line-text">{log}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'metrics' && (
            <div className="console-metrics-view">
              <div className="metric-box">
                <span className="metric-label">Execution Time</span>
                <span className="metric-number">
                  <Clock size={15} /> {metrics?.timeElapsedMs ?? 0} ms
                </span>
              </div>
              <div className="metric-box">
                <span className="metric-label">Comparisons</span>
                <span className="metric-number text-amber">{metrics?.comparisons ?? 0}</span>
              </div>
              <div className="metric-box">
                <span className="metric-label">Swaps</span>
                <span className="metric-number text-rose">{metrics?.swaps ?? 0}</span>
              </div>
              <div className="metric-box">
                <span className="metric-label">Array Writes</span>
                <span className="metric-number text-purple">{metrics?.writes ?? 0}</span>
              </div>
              <div className="metric-box">
                <span className="metric-label">Nodes Visited</span>
                <span className="metric-number text-emerald">{metrics?.nodesVisited ?? 0}</span>
              </div>
              <div className="metric-box">
                <span className="metric-label">Edges Traversed</span>
                <span className="metric-number text-cyan">{metrics?.edgesTraversed ?? 0}</span>
              </div>
              {metrics?.pathCost !== undefined && (
                <div className="metric-box">
                  <span className="metric-label">Path Total Cost</span>
                  <span className="metric-number text-amber font-bold">{metrics.pathCost}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
