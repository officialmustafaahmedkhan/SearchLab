import React, { useState, useEffect, useRef } from 'react';
import { ALGORITHM_CATALOG } from './algorithms/catalog';
import { AlgorithmDefinition } from './types/algorithms';
import { ExecutionLanguage } from './types/execution';
import { PlaybackController, PlaybackState } from './engine/playback';
import { extractGraphFromCode, fetchEngineCapabilities, getExecutor } from './engine/executor';

import { HeaderNav } from './components/layout/HeaderNav';
import { LeftSidebar } from './components/layout/LeftSidebar';
import { CodeEditor } from './components/editor/CodeEditor';
import { VisualizerContainer } from './components/visualizer/VisualizerContainer';
import { TimelineControls } from './components/timeline/TimelineControls';
import { RightInspector } from './components/inspectors/RightInspector';
import { ConsoleBottomPanel } from './components/console/ConsoleBottomPanel';
import { ShortcutsModal } from './components/modals/ShortcutsModal';
import { GraphJsonModal } from './components/modals/GraphJsonModal';

import { PanelLeftClose, PanelLeft, PanelRightClose, PanelRight } from 'lucide-react';

/** Resolve the default source for an algorithm in a given language. */
const codeFor = (algo: AlgorithmDefinition, lang: ExecutionLanguage): string =>
  lang === 'java' ? algo.defaultJavaCode : algo.defaultPythonCode;

export const App: React.FC = () => {
  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Currently selected algorithm
  const [currentAlgorithm, setCurrentAlgorithm] = useState<AlgorithmDefinition>(
    ALGORITHM_CATALOG[0] // Default to BFS
  );

  // Active code in Monaco editor
  const [editorCode, setEditorCode] = useState<string>(codeFor(currentAlgorithm, 'python'));

  // Original code for comparison mode
  const [comparisonCode, setComparisonCode] = useState<string>(codeFor(currentAlgorithm, 'python'));
  const [isComparing, setIsComparing] = useState<boolean>(false);

  // Custom / Active input
  const [currentInput, setCurrentInput] = useState<any>(currentAlgorithm.defaultInput);

  // Language: 'python' or 'java'
  const [codeLanguage, setCodeLanguage] = useState<ExecutionLanguage>('python');

  // Languages the engine can actually run. Both are assumed until the engine
  // reports otherwise, so the local experience is unchanged.
  const [availableLanguages, setAvailableLanguages] = useState<ExecutionLanguage[]>([
    'python',
    'java',
  ]);

  // Mirrors codeLanguage so the one-shot capabilities probe can read the
  // current value without being listed as a dependency.
  const codeLanguageRef = useRef<ExecutionLanguage>(codeLanguage);
  codeLanguageRef.current = codeLanguage;

  // Execution mode: Mode A ('instrumented') or Mode B ('trace')
  const [executionMode, setExecutionMode] = useState<'instrumented' | 'trace'>('instrumented');

  // Execution state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [runtimeError, setRuntimeError] = useState<{
    message: string;
    line?: number;
    column?: number;
    stack?: string;
  } | undefined>(undefined);

  // Panel layout toggles
  const [isLeftCollapsed, setIsLeftCollapsed] = useState<boolean>(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState<boolean>(false);
  const [isBottomCollapsed, setIsBottomCollapsed] = useState<boolean>(false);
  const [centerLayout, setCenterLayout] = useState<'split-horizontal' | 'split-vertical'>('split-horizontal');

  // Modals
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [graphModalMode, setGraphModalMode] = useState<'export' | 'import' | null>(null);

  // Playback controller reference
  const playbackRef = useRef<PlaybackController>(new PlaybackController([]));
  const [playbackState, setPlaybackState] = useState<PlaybackState>(
    playbackRef.current.getState()
  );

  // Line the editor should scroll to (set when a console error is clicked)
  const [revealLine, setRevealLine] = useState<number | undefined>(undefined);

  // True while the editor code is being scanned for a graph to visualise
  const [isExtractingGraph, setIsExtractingGraph] = useState<boolean>(false);

  // Subscribe to playback changes
  useEffect(() => {
    const unsubscribe = playbackRef.current.subscribe((state) => {
      setPlaybackState(state);
    });
    return unsubscribe;
  }, []);

  // When selected algorithm changes
  const handleSelectAlgorithm = (algo: AlgorithmDefinition) => {
    playbackRef.current.pause();
    playbackRef.current.setEvents([]);
    setCurrentAlgorithm(algo);
    const code = codeFor(algo, codeLanguage);
    setEditorCode(code);
    setComparisonCode(code);
    setCurrentInput(JSON.parse(JSON.stringify(algo.defaultInput)));
    setConsoleLogs([]);
    setRuntimeError(undefined);
    setIsComparing(false);
  };

  // Switch between Python and Java
  const handleLanguageChange = (lang: ExecutionLanguage) => {
    // Ignore a language the engine cannot run (e.g. Java on a hosted build).
    if (!availableLanguages.includes(lang)) return;
    playbackRef.current.pause();
    setCodeLanguage(lang);
    const code = codeFor(currentAlgorithm, lang);
    setEditorCode(code);
    setComparisonCode(code);
    setRuntimeError(undefined);
    playbackRef.current.setEvents([]);
  };

  /**
   * Ask the engine which languages it can run. Hosted engines without a JDK
   * (e.g. Vercel) report Python only, and the Java option is then hidden so it
   * can never be selected only to fail.
   */
  useEffect(() => {
    let cancelled = false;
    fetchEngineCapabilities().then((caps) => {
      if (cancelled) return;
      setAvailableLanguages(caps.languages);
      // If Java is gone (e.g. the page loaded on a hosted build) fall back to
      // Python rather than leaving the editor on a language that cannot run.
      if (!caps.languages.includes(codeLanguageRef.current)) {
        handleLanguageChange(caps.languages[0] ?? 'python');
      }
    });
    return () => {
      cancelled = true;
    };
    // Probe once on mount: engine capabilities do not change while the app runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset code to algorithm default
  const handleResetDefaultCode = () => {
    playbackRef.current.pause();
    setEditorCode(codeFor(currentAlgorithm, codeLanguage));
    setRuntimeError(undefined);
  };

  // Select input preset
  const handleSelectPreset = (presetInput: any) => {
    playbackRef.current.pause();
    setCurrentInput(JSON.parse(JSON.stringify(presetInput)));
    playbackRef.current.setEvents([]);
    setConsoleLogs([]);
    setRuntimeError(undefined);
  };

  /**
   * Scan the current editor code for an adjacency-list graph and, if found,
   * rebuild the Interactive Visualization Canvas from it.
   */
  const handleExtractGraphFromCode = async () => {
    if (isExtractingGraph) return;
    setIsExtractingGraph(true);
    try {
      const outcome = await extractGraphFromCode(editorCode);
      if (outcome.graph) {
        playbackRef.current.pause();
        playbackRef.current.setEvents([]);
        setCurrentInput(outcome.graph);
        setConsoleLogs([outcome.message]);
        setRuntimeError(undefined);
      } else {
        setConsoleLogs([outcome.message]);
      }
    } finally {
      setIsExtractingGraph(false);
    }
  };

  // Run the code
  const handleRunCode = async () => {
    setIsRunning(true);
    setRuntimeError(undefined);
    setConsoleLogs([]);
    playbackRef.current.pause();

    let graphInput = currentInput;
    const builtInCode = codeFor(currentAlgorithm, codeLanguage);

    // If the editor holds a custom program that defines its own graph, the
    // canvas should reflect that graph instead of the algorithm's preset.
    if (currentAlgorithm.target === 'graph' && editorCode.trim() !== builtInCode.trim()) {
      const outcome = await extractGraphFromCode(editorCode);
      if (outcome.graph) {
        graphInput = outcome.graph;
        setCurrentInput(graphInput);
      }
    }

    try {
      const executor = getExecutor(codeLanguage);
      const result = await executor.execute({
        code: editorCode,
        input: graphInput,
        mode: executionMode,
        timeoutMs: 30000,
        maxEvents: 20000,
        timeLimitMs: 15000,
      });

      setConsoleLogs(result.logs || []);

      if (!result.success && result.error) {
        setRuntimeError(result.error);
        setIsBottomCollapsed(false);
      }

      playbackRef.current.setEvents(result.events);

      // If events were recorded, automatically play or start stepping
      if (result.events.length > 0) {
        playbackRef.current.play();
      }
    } catch (err: any) {
      setRuntimeError({
        message: err.message || 'Execution failed',
      });
      setIsBottomCollapsed(false);
    } finally {
      setIsRunning(false);
    }
  };

  // Stop execution
  const handleStop = () => {
    getExecutor(codeLanguage).terminate();
    playbackRef.current.pause();
    setIsRunning(false);
  };

  // Reset playback
  const handleReset = () => {
    playbackRef.current.reset();
  };

  // Current active line in Monaco editor
  const currentLine = playbackState.currentEvent?.line;
  const errorLine = runtimeError?.line;

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcut if user is typing inside an input or textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.classList.contains('inputarea') // Monaco textarea
      ) {
        // Allow Ctrl+Enter or F5 to run even inside Monaco!
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          handleRunCode();
          return;
        }
        if (e.key === 'F5') {
          e.preventDefault();
          handleRunCode();
          return;
        }
        return;
      }

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (playbackState.isPlaying) {
          playbackRef.current.pause();
        } else {
          playbackRef.current.play();
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        playbackRef.current.stepForward();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        playbackRef.current.stepBackward();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleReset();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleStop();
      } else if (e.key === 'F5') {
        e.preventDefault();
        handleRunCode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editorCode, currentInput, executionMode, playbackState.isPlaying, codeLanguage]);

  return (
    <div className={`app-root ${theme}`}>
      {/* Header */}
      <HeaderNav
        algorithm={currentAlgorithm}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        executionMode={executionMode}
        onChangeExecutionMode={setExecutionMode}
        language={codeLanguage}
        availableLanguages={availableLanguages}
        onChangeLanguage={handleLanguageChange}
        onResetDefaultCode={handleResetDefaultCode}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onExportGraph={() => setGraphModalMode('export')}
        onImportGraph={() => setGraphModalMode('import')}
      />

      {/* Main Multi-Panel Workspace */}
      <div className="workspace-container">
        {/* Left Panel: Algorithm Catalog & Presets */}
        <LeftSidebar
          currentAlgorithm={currentAlgorithm}
          onSelectAlgorithm={handleSelectAlgorithm}
          onSelectPreset={handleSelectPreset}
          isCollapsed={isLeftCollapsed}
          onToggleCollapse={() => setIsLeftCollapsed(!isLeftCollapsed)}
        />

        {/* Center Main Stage (Split: Monaco Code Editor + Visualization Canvas) */}
        <main className="center-stage">
          {/* Top Panel Toggle / Toolbar */}
          <div className="stage-quick-bar">
            <button
              className="stage-toggle-btn"
              onClick={() => setIsLeftCollapsed(!isLeftCollapsed)}
              title={isLeftCollapsed ? 'Expand Catalog' : 'Collapse Catalog'}
            >
              {isLeftCollapsed ? <PanelLeft size={15} /> : <PanelLeftClose size={15} />}
            </button>

            <div className="layout-switcher">
              <button
                className={`btn btn-xs ${centerLayout === 'split-horizontal' ? 'btn-active' : 'btn-subtle'}`}
                onClick={() => setCenterLayout('split-horizontal')}
                title="Side by Side Layout"
              >
                Side by Side
              </button>
              <button
                className={`btn btn-xs ${centerLayout === 'split-vertical' ? 'btn-active' : 'btn-subtle'}`}
                onClick={() => setCenterLayout('split-vertical')}
                title="Stacked Layout"
              >
                Stacked
              </button>
            </div>

            <button
              className="stage-toggle-btn"
              onClick={() => setIsRightCollapsed(!isRightCollapsed)}
              title={isRightCollapsed ? 'Expand Inspector' : 'Collapse Inspector'}
            >
              {isRightCollapsed ? <PanelRight size={15} /> : <PanelRightClose size={15} />}
            </button>
          </div>

          {/* Center Content: Code Editor and Visualizer */}
          <div className={`center-content-split ${centerLayout}`}>
            {/* Visualizer Canvas */}
            <div className="stage-visualizer-pane">
              <VisualizerContainer
                algorithm={currentAlgorithm}
                snapshot={playbackState.currentSnapshot}
                currentInput={currentInput}
                onUpdateInput={setCurrentInput}
                isRunning={isRunning}
                onExtractFromCode={
                  currentAlgorithm.target === 'graph' ? handleExtractGraphFromCode : undefined
                }
                isExtracting={isExtractingGraph}
              />
            </div>

            {/* Monaco Code Editor */}
            <div className="stage-editor-pane">
              <CodeEditor
                code={editorCode}
                onChange={setEditorCode}
                language={codeLanguage}
                currentLine={currentLine}
                errorLine={errorLine}
                revealLine={revealLine}
                theme={theme}
                isComparing={isComparing}
                comparisonCode={comparisonCode}
                onToggleCompare={() => setIsComparing(!isComparing)}
                onRun={handleRunCode}
                onStop={handleStop}
                onReset={handleReset}
                isRunning={isRunning}
              />
            </div>
          </div>

          {/* Playback Timeline Controller */}
          <TimelineControls
            playbackState={playbackState}
            onPlay={() => playbackRef.current.play()}
            onPause={() => playbackRef.current.pause()}
            onStepForward={() => playbackRef.current.stepForward()}
            onStepBackward={() => playbackRef.current.stepBackward()}
            onJumpToStep={(step) => playbackRef.current.jumpToStep(step)}
            onReset={handleReset}
            onJumpToEnd={() => playbackRef.current.jumpToEnd()}
            onSpeedChange={(ms) => playbackRef.current.setSpeed(ms)}
          />

          {/* Bottom Console Panel */}
          <ConsoleBottomPanel
            logs={consoleLogs}
            error={runtimeError}
            metrics={playbackState.currentSnapshot?.metrics}
            onJumpToLine={(line) => setRevealLine(line)}
            onClearLogs={() => setConsoleLogs([])}
            isCollapsed={isBottomCollapsed}
            onToggleCollapse={() => setIsBottomCollapsed(!isBottomCollapsed)}
          />
        </main>

        {/* Right Panel: Variable & Data Structure Inspector */}
        {!isRightCollapsed && (
          <aside className="right-sidebar">
            <RightInspector
              snapshot={playbackState.currentSnapshot}
              algorithm={currentAlgorithm}
            />
          </aside>
        )}
      </div>

      {/* Modals */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      <GraphJsonModal
        isOpen={graphModalMode !== null}
        mode={graphModalMode || 'export'}
        graphData={currentInput}
        onClose={() => setGraphModalMode(null)}
        onImport={(newData) => {
          setCurrentInput(newData);
          playbackRef.current.setEvents([]);
        }}
      />
    </div>
  );
};

export default App;
