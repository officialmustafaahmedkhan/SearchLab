import React, { useState } from 'react';
import { StateSnapshot } from '../../types/execution';
import { AlgorithmDefinition } from '../../types/algorithms';
import { Layers, ListOrdered, BookOpen, Code2 } from 'lucide-react';

interface RightInspectorProps {
  snapshot: StateSnapshot | null;
  algorithm: AlgorithmDefinition;
}

export const RightInspector: React.FC<RightInspectorProps> = ({ snapshot, algorithm }) => {
  const [activeTab, setActiveTab] = useState<'vars' | 'structures' | 'explanation'>('vars');

  const variables = snapshot?.variables || {};
  const queueItems = snapshot?.queueItems || [];
  const stackItems = snapshot?.stackItems || [];
  const callStack = snapshot?.callStack || [];

  return (
    <div className="right-inspector-panel">
      {/* Inspector Tab Bar */}
      <div className="inspector-tabs">
        <button
          className={`inspector-tab ${activeTab === 'vars' ? 'active' : ''}`}
          onClick={() => setActiveTab('vars')}
        >
          <Layers size={14} />
          <span>Variables</span>
        </button>
        <button
          className={`inspector-tab ${activeTab === 'structures' ? 'active' : ''}`}
          onClick={() => setActiveTab('structures')}
        >
          <ListOrdered size={14} />
          <span>Frontier / Stack</span>
        </button>
        <button
          className={`inspector-tab ${activeTab === 'explanation' ? 'active' : ''}`}
          onClick={() => setActiveTab('explanation')}
        >
          <BookOpen size={14} />
          <span>Theory & Pseudocode</span>
        </button>
      </div>

      <div className="inspector-content">
        {/* Variables Inspector */}
        {activeTab === 'vars' && (
          <div className="tab-pane-vars">
            <div className="inspector-section-title">Local Scope & Tracked Variables</div>
            {Object.keys(variables).length === 0 ? (
              <div className="empty-state-notice">
                No variables recorded yet. Run the algorithm to inspect live variables.
              </div>
            ) : (
              <div className="variables-table">
                {Object.entries(variables).map(([name, val]) => (
                  <div key={name} className="variable-row">
                    <span className="var-name">{name}</span>
                    <span className="var-value">
                      {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Call Stack section if recursion present */}
            {callStack.length > 0 && (
              <div className="call-stack-section">
                <div className="inspector-section-title">Call Stack ({callStack.length})</div>
                <div className="call-stack-list">
                  {callStack.map((frame, idx) => (
                    <div key={idx} className="call-stack-frame">
                      <span className="frame-index">#{callStack.length - idx}</span>
                      <span className="frame-name">{frame}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Data Structures (Queue / Stack / Frontier) */}
        {activeTab === 'structures' && (
          <div className="tab-pane-structures">
            {/* Queue / Frontier */}
            <div className="inspector-section-title">
              Queue / Frontier ({queueItems.length})
            </div>
            {queueItems.length === 0 ? (
              <div className="empty-state-notice">Queue / Frontier is empty.</div>
            ) : (
              <div className="structure-items-list">
                {queueItems.map((item, idx) => (
                  <div key={idx} className="structure-item queue-item">
                    <span className="item-badge">#{idx + 1}</span>
                    <span className="item-content">
                      {typeof item === 'object' ? JSON.stringify(item) : String(item)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Stack */}
            {stackItems.length > 0 && (
              <>
                <div className="inspector-section-title mt-4">
                  Stack ({stackItems.length})
                </div>
                <div className="structure-items-list">
                  {[...stackItems].reverse().map((item, idx) => (
                    <div key={idx} className="structure-item stack-item">
                      <span className="item-badge">Top {idx === 0 ? '(peek)' : `#${idx}`}</span>
                      <span className="item-content">
                        {typeof item === 'object' ? JSON.stringify(item) : String(item)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Algorithm Theory & Pseudocode */}
        {activeTab === 'explanation' && (
          <div className="tab-pane-explanation">
            <h3 className="explanation-title">{algorithm.name}</h3>
            <p className="explanation-text">{algorithm.detailedExplanation}</p>

            <div className="complexity-grid">
              <div className="complexity-card">
                <span className="complexity-label">Best Time</span>
                <span className="complexity-val">{algorithm.timeComplexity.best}</span>
              </div>
              <div className="complexity-card">
                <span className="complexity-label">Average Time</span>
                <span className="complexity-val">{algorithm.timeComplexity.average}</span>
              </div>
              <div className="complexity-card">
                <span className="complexity-label">Worst Time</span>
                <span className="complexity-val">{algorithm.timeComplexity.worst}</span>
              </div>
              <div className="complexity-card">
                <span className="complexity-label">Space Complexity</span>
                <span className="complexity-val">{algorithm.spaceComplexity}</span>
              </div>
            </div>

            <div className="inspector-section-title mt-4">
              <Code2 size={13} /> Algorithm Pseudocode
            </div>
            <pre className="pseudocode-block">
              <code>{algorithm.pseudocode}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
