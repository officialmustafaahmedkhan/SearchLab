import React from 'react';
import { Sun, Moon, HelpCircle, RefreshCw, Upload, DownloadCloud, Sparkles, TerminalSquare, Compass } from 'lucide-react';
import { AlgorithmDefinition } from '../../types/algorithms';
import { ExecutionLanguage } from '../../types/execution';

interface HeaderNavProps {
  algorithm: AlgorithmDefinition;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  executionMode: 'instrumented' | 'trace';
  onChangeExecutionMode: (mode: 'instrumented' | 'trace') => void;
  language: 'python' | 'java';
  availableLanguages?: ExecutionLanguage[];
  onChangeLanguage: (lang: 'python' | 'java') => void;
  onResetDefaultCode: () => void;
  onOpenShortcuts: () => void;
  onExportGraph?: () => void;
  onImportGraph?: () => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  algorithm,
  theme,
  onToggleTheme,
  executionMode,
  onChangeExecutionMode,
  language,
  availableLanguages = ['python', 'java'],
  onChangeLanguage,
  onResetDefaultCode,
  onOpenShortcuts,
  onExportGraph,
  onImportGraph,
}) => {
  return (
    <header className="app-header">
      {/* Brand & Algorithm Name */}
      <div className="header-left">
        <div className="brand-logo">
          <div className="logo-icon-wrapper">
            <Compass size={20} className="logo-icon" />
          </div>
          <span className="brand-name">SearchLab</span>
          <span className="brand-badge">Code-Driven</span>
        </div>

        <div className="header-breadcrumbs">
          <span className="breadcrumb-category">{algorithm.category.toUpperCase()}</span>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-algorithm">{algorithm.name}</span>
        </div>
      </div>

      {/* Center Execution Mode Selector */}
      <div className="header-center">
        <div className="mode-segmented-control">
          <button
            className={`mode-segment ${executionMode === 'instrumented' ? 'active' : ''}`}
            onClick={() => onChangeExecutionMode('instrumented')}
            title="Instrumented Learning Mode (visualizer API hooks)"
          >
            <Sparkles size={13} />
            <span>Learning Mode</span>
          </button>
          <button
            className={`mode-segment ${executionMode === 'trace' ? 'active' : ''}`}
            onClick={() => onChangeExecutionMode('trace')}
            title="Debugger & Tracing Mode (line hits and proxy tracking)"
          >
            <TerminalSquare size={13} />
            <span>Trace Mode</span>
          </button>
        </div>

        {/* Language Selector: Python vs Java */}
        <div className="mode-segmented-control ml-3">
          <button
            className={`mode-segment ${language === 'python' ? 'active' : ''}`}
            onClick={() => onChangeLanguage('python')}
            title="Code in Python 3 (execution tracing via sys.settrace)"
          >
            Python 3
          </button>
          {availableLanguages.includes('java') && (
            <button
              className={`mode-segment ${language === 'java' ? 'active' : ''}`}
              onClick={() => onChangeLanguage('java')}
              title="Code in Java (compiled + traced via the JDK Debug Interface)"
            >
              Java
            </button>
          )}
        </div>
      </div>

      {/* Header Actions */}
      <div className="header-right">
        {algorithm.target === 'graph' && onExportGraph && (
          <button
            className="header-action-btn"
            onClick={onExportGraph}
            title="Export Graph to JSON"
          >
            <DownloadCloud size={16} />
            <span className="btn-label-desktop">Export</span>
          </button>
        )}

        {algorithm.target === 'graph' && onImportGraph && (
          <button
            className="header-action-btn"
            onClick={onImportGraph}
            title="Import Graph JSON"
          >
            <Upload size={16} />
            <span className="btn-label-desktop">Import</span>
          </button>
        )}

        <button
          className="header-action-btn"
          onClick={onResetDefaultCode}
          title="Reset Code to Working Default"
        >
          <RefreshCw size={15} />
          <span className="btn-label-desktop">Reset Code</span>
        </button>

        <button
          className="header-action-btn"
          onClick={onOpenShortcuts}
          title="Keyboard Shortcuts & Help"
        >
          <HelpCircle size={16} />
        </button>

        <button
          className="header-action-btn theme-toggle-btn"
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>
    </header>
  );
};
