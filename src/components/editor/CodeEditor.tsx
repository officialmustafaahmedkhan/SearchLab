import React, { useRef, useEffect } from 'react';
import Editor, { DiffEditor, OnMount } from '@monaco-editor/react';
import { Download, Copy, Play, Square, RotateCcw, GitCompare, Code } from 'lucide-react';

interface CodeEditorProps {
  code: string;
  onChange: (val: string) => void;
  language?: 'python' | 'java';
  currentLine?: number;
  errorLine?: number;
  revealLine?: number;
  theme: 'dark' | 'light';
  isComparing?: boolean;
  comparisonCode?: string;
  onToggleCompare?: () => void;
  onRun: () => void;
  onStop: () => void;
  onReset: () => void;
  isRunning: boolean;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  code,
  onChange,
  language = 'python',
  currentLine,
  errorLine,
  revealLine,
  theme,
  isComparing = false,
  comparisonCode = '',
  onToggleCompare,
  onRun,
  onStop,
  onReset,
  isRunning,
}) => {
  const editorRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  // Update line highlight when currentLine or errorLine changes
  useEffect(() => {
    if (!editorRef.current) return;

    const newDecorations: any[] = [];

    if (currentLine && currentLine > 0) {
      newDecorations.push({
        range: {
          startLineNumber: currentLine,
          startColumn: 1,
          endLineNumber: currentLine,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          className: 'active-execution-line-bg',
          glyphMarginClassName: 'active-execution-glyph',
        },
      });

      // Gently scroll into view if necessary
      editorRef.current.revealLineInCenterIfOutsideViewport(currentLine);
    }

    if (errorLine && errorLine > 0) {
      newDecorations.push({
        range: {
          startLineNumber: errorLine,
          startColumn: 1,
          endLineNumber: errorLine,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          className: 'error-execution-line-bg',
          glyphMarginClassName: 'error-execution-glyph',
        },
      });
      editorRef.current.revealLineInCenter(errorLine);
    }

    decorationsRef.current = editorRef.current.deltaDecorations(
      decorationsRef.current,
      newDecorations
    );
  }, [currentLine, errorLine]);

  // Scroll to and focus a requested line (e.g. from a console error badge)
  useEffect(() => {
    if (!editorRef.current || !revealLine || revealLine <= 0) return;
    editorRef.current.revealLineInCenter(revealLine);
    editorRef.current.setPosition({ lineNumber: revealLine, column: 1 });
    editorRef.current.focus();
  }, [revealLine]);

  // Download code
  const handleDownload = () => {
    const fileName = language === 'java' ? 'Main.java' : 'algorithm.py';
    const mimeType = language === 'java' ? 'text/x-java-source' : 'text/x-python';
    const blob = new Blob([code], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
  };

  return (
    <div className="code-editor-wrapper">
      {/* Editor Header Bar */}
      <div className="editor-header">
        <div className="editor-tabs">
          <div className="editor-tab active">
            <Code size={14} />
            <span>{language === 'java' ? 'Main.java' : 'algorithm.py'}</span>
            {currentLine && (
              <span className="current-line-badge">Line {currentLine}</span>
            )}
          </div>
        </div>

        <div className="editor-controls">
          <button
            className="editor-btn"
            onClick={onToggleCompare}
            title="Toggle Code Comparison Mode"
          >
            <GitCompare size={14} />
            <span>{isComparing ? 'Exit Compare' : 'Compare'}</span>
          </button>
          <button
            className="editor-btn"
            onClick={handleCopy}
            title="Copy Code"
          >
            <Copy size={14} />
          </button>
          <button
            className="editor-btn"
            onClick={handleDownload}
            title="Download Source File"
          >
            <Download size={14} />
          </button>

          <div className="editor-divider" />

          {isRunning ? (
            <button className="btn btn-sm btn-danger" onClick={onStop}>
              <Square size={13} fill="currentColor" /> Stop
            </button>
          ) : (
            <button className="btn btn-sm btn-primary" onClick={onRun}>
              <Play size={13} fill="currentColor" /> Run Code
            </button>
          )}

          <button className="btn btn-sm btn-subtle" onClick={onReset} title="Reset to Start">
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      {/* Editor Main Canvas */}
      <div className="editor-canvas-container">
        {isComparing ? (
          <DiffEditor
            height="100%"
            language={language}
            theme={theme === 'dark' ? 'vs-dark' : 'light'}
            original={comparisonCode || '// Original code'}
            modified={code}
            options={{
              readOnly: false,
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        ) : (
          <Editor
            height="100%"
            language={language}
            theme={theme === 'dark' ? 'vs-dark' : 'light'}
            value={code}
            onChange={(val) => onChange(val || '')}
            onMount={handleEditorDidMount}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              glyphMargin: true,
              tabSize: 2,
              wordWrap: 'on',
              lineNumbersMinChars: 3,
            }}
          />
        )}
      </div>
    </div>
  );
};
