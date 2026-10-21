import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Upload, DownloadCloud, AlertTriangle } from 'lucide-react';
import { GraphData } from '../../types/graph';
import { validateGraphData } from '../../engine/executor';
import { withLayout } from '../../utils/graphLayout';

interface GraphJsonModalProps {
  isOpen: boolean;
  mode: 'export' | 'import';
  graphData: GraphData;
  onClose: () => void;
  onImport: (data: GraphData) => void;
}

export const GraphJsonModal: React.FC<GraphJsonModalProps> = ({
  isOpen,
  mode,
  graphData,
  onClose,
  onImport,
}) => {
  const [jsonString, setJsonString] = useState('');
  const [copied, setCopied] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'export') {
        setJsonString(JSON.stringify(graphData, null, 2));
      } else {
        setJsonString('');
      }
      setParseError(null);
      setCopied(false);
    }
  }, [isOpen, mode, graphData]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyImport = () => {
    try {
      const parsed = JSON.parse(jsonString);
      const errors = validateGraphData(parsed);
      if (errors.length > 0) {
        throw new Error(errors[0]);
      }
      onImport(withLayout(parsed as GraphData));
      onClose();
    } catch (err: any) {
      setParseError(err.message || 'Failed to parse JSON');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            {mode === 'export' ? (
              <>
                <DownloadCloud size={18} className="text-cyan" />
                <h3>Export Graph Data (JSON)</h3>
              </>
            ) : (
              <>
                <Upload size={18} className="text-cyan" />
                <h3>Import Custom Graph (JSON)</h3>
              </>
            )}
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {mode === 'import' && (
            <p className="modal-intro">
              Paste your custom graph JSON below with <code>nodes</code>, <code>edges</code>, <code>startNodeId</code>, and <code>goalNodeId</code>.
            </p>
          )}

          {parseError && (
            <div className="modal-error-banner">
              <AlertTriangle size={15} />
              <span>{parseError}</span>
            </div>
          )}

          <textarea
            className="json-textarea"
            rows={14}
            value={jsonString}
            readOnly={mode === 'export'}
            onChange={(e) => {
              setJsonString(e.target.value);
              setParseError(null);
            }}
          />

          <div className="modal-footer-actions">
            {mode === 'export' ? (
              <button className="btn btn-sm btn-primary" onClick={handleCopy}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy JSON'}</span>
              </button>
            ) : (
              <button className="btn btn-sm btn-primary" onClick={handleApplyImport}>
                <Upload size={14} />
                <span>Apply & Load Graph</span>
              </button>
            )}
            <button className="btn btn-sm btn-subtle" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
