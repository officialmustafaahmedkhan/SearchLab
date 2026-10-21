import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Keyboard size={18} className="text-cyan" />
            <h3>SearchLab Shortcuts & Documentation</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <section className="modal-section">
            <h4>Keyboard Shortcuts</h4>
            <div className="shortcuts-table">
              <div className="shortcut-row">
                <kbd>F5</kbd> or <kbd>Ctrl + Enter</kbd>
                <span>Execute / Run Current Algorithm Code</span>
              </div>
              <div className="shortcut-row">
                <kbd>Space</kbd>
                <span>Play / Pause Step Execution</span>
              </div>
              <div className="shortcut-row">
                <kbd>→</kbd> (Right Arrow)
                <span>Step Forward (Next Step)</span>
              </div>
              <div className="shortcut-row">
                <kbd>←</kbd> (Left Arrow)
                <span>Step Backward (Previous Step)</span>
              </div>
              <div className="shortcut-row">
                <kbd>R</kbd>
                <span>Reset Execution to Step 0</span>
              </div>
              <div className="shortcut-row">
                <kbd>Esc</kbd>
                <span>Stop / Terminate Execution</span>
              </div>
            </div>
          </section>

          <section className="modal-section mt-4">
            <h4>Visualizer API Reference (Mode A)</h4>
            <div className="api-reference-list">
              <div className="api-item">
                <code>visualizer.visitNode(id)</code>
                <span>Marks node as expanded and updates nodes visited count.</span>
              </div>
              <div className="api-item">
                <code>visualizer.traverseEdge(from, to, cost)</code>
                <span>Highlights edge transition and updates traversed count.</span>
              </div>
              <div className="api-item">
                <code>visualizer.updateCost(id, cost)</code>
                <span>Updates shortest path distance / g(n) cost displayed on node.</span>
              </div>
              <div className="api-item">
                <code>visualizer.updateQueue(items)</code>
                <span>Updates the priority queue or frontier in the inspection panel.</span>
              </div>
              <div className="api-item">
                <code>visualizer.compare(i, j)</code>
                <span>Compares array elements at index i and j (returns boolean).</span>
              </div>
              <div className="api-item">
                <code>visualizer.swap(i, j)</code>
                <span>Swaps array elements in visualizer state.</span>
              </div>
              <div className="api-item">
                <code>visualizer.markPath(path, totalCost)</code>
                <span>Highlights the final computed path to goal on the graph.</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
