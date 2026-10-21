# SearchLab — Code-to-Graph Algorithm Visualizer

SearchLab runs algorithm code (Python or Java), captures an execution trace, and
renders it as a live, step-through graph/array/tree/hash visualization.

## Execution pipeline

```
code input  →  parse/compile  →  execution trace  →  graph data model  →  live render  →  step controls
```

1. You edit code in the Monaco editor and press **Run Code**.
2. The frontend posts the code + input to the local execution engine.
3. The engine compiles/runs it, recording every semantic event (comparison,
   swap, node visit, edge traversal, queue update, goal found, …).
4. Events are normalised into `ExecutionEvent` records with immutable
   `StateSnapshot`s (line number, locals, call stack, metrics).
5. The `PlaybackController` exposes these events to the UI.
6. `TimelineControls` (play / pause / step / jump / speed) drives the renderer,
   which re-renders the graph, array, tree, or hash-table for the active event.

The graph structure comes from the current input document; only highlighting,
variables, and metrics come from the execution snapshot.

### Building the canvas from your own code

For graph algorithms the canvas can be rebuilt from the graph your code defines,
instead of the algorithm's preset. Two ways:

- **Automatic** — press **Run Code** with custom code. If the code contains an
  adjacency-list literal (and differs from the algorithm's built-in sample), the
  engine extracts it first and the canvas is redrawn from it before execution.
- **Manual** — press **▷ Use Graph from Code** in the canvas header to scan the
  editor on demand (also refreshes the canvas without running).

The engine (`POST /extract-graph`) parses the code with Python's `ast` module and
recognises these adjacency-list shapes (keys == nodes, values == neighbours):

```python
graph = {'A': [('B', 5), ('C', 2)], 'B': [('D', 4)], 'C': [('D', 7)], 'D': []}
graph = {'A': {'B': 5, 'C': 2}, 'B': {'D': 4}, 'C': {'D': 7}, 'D': {}}
```

`START` / `GOAL` assignments in the file are read for the start/goal nodes (they
default to the first/last node otherwise). Because the pasted literals carry no
coordinates, the frontend runs a deterministic force-directed layout
(`src/utils/graphLayout.ts`) to place the nodes inside the canvas.

Graphs offered via **Import** (JSON) are validated too: ids must be unique, edge
endpoints must exist, and costs must be numeric — clear errors are shown in the
modal instead of failing silently.

### Visualising your own algorithm (no `visualizer.*` calls needed)

Students usually paste their own search code, which never calls the
`visualizer.*` helpers. In that case the engine **derives** the graph state from
the locals seen while the code runs, so the Interactive Visualization Canvas
still animates:

- **Trace mode** — every executed line is inspected; the node being expanded
  (`node`/`current`/`u`/…), the visited set (`visited`/`explored`/…), the
  current edge (via a `parent`/`prev` map or a neighbour local) and the
  discovered path (`path`/`route`/…) become `NODE_EXPANDED` / `EDGE_RELAXED` /
  `GOAL_FOUND` events.
- **Learning (instrumented) mode** — the same derivation is used **only when the
  code makes no `visualizer.*` (Python) / `SearchLab.viz` (Java) calls at all**.
  If the code drives the API itself, that explicit narration is respected and
  nothing is derived.

A value only counts as a node when it matches a graph node id or label (labels
also match an underscore form, e.g. `Rimnicu_Vilcea` → `Rimnicu Vilcea`), so
unrelated locals (`total += i`) never invent highlights. For Java, the tracer
renders graph-relevant collections with their elements (`{A, B}`, `[A, B, D]`)
instead of the opaque `instance of java.util.HashSet`.

## Supported languages

Python and Java only. **JavaScript support was removed** (engine, worker, and
instrumenter were deleted; the language selector no longer offers it).

Each language supports two execution modes:

- **Instrumented** (Mode A) — the program calls the visualizer API
  (`visualizer.compare(...)`, `SearchLab.viz.visitNode(...)`, …). Fast and
  semantically precise.
- **Trace** (Mode B) — the engine traces the program and records per-line
  `STEP` events. Python uses `sys.settrace`; Java uses the JDK's
  `jdk.jdi` module (`com.sun.jdi`) from the bundled `JavaTracer`.

### Java runtime

`java_engine/SearchLab.java` is a bundled visualizer runtime that mirrors the
Python recorder. `java_engine/JavaTracer.java` is a JDI auto-tracer. The engine
compiles both into `java_engine/classes` on first use and recompiles whenever the
sources change (guarded by a lock so concurrent requests don't race).

User code that declares a `package` has that line blanked out (line numbers are
preserved) so the default-package `SearchLab` runtime stays visible.

### Infinite-loop safety

- Python: the tracer is always active and enforces a wall-clock deadline
  (default 15 s, overridable per request) plus an event cap.
- Java: the subprocess is bounded by a hard timeout (default 30 s) that kills
  the whole process tree — needed on Windows because killing a `java` launcher
  leaves the real JVM child running.

## Setup

Prerequisites:

- **Node.js** (npm) for the frontend.
- **Python 3.10+** with `fastapi` and `uvicorn` (`requirements.txt`).
- **JDK 9+** (`javac` and `java` on `PATH`) for Java execution. The bundled
  runtime uses `jdk.jdi`, available in any modern JDK.

Install:

```bash
npm install
npm run engine:install   # pip install -r requirements.txt
```

Run (two terminals):

```bash
npm run engine           # execution engine on http://127.0.0.1:8000
npm run dev              # Vite dev server on http://localhost:5173
```

Health check: `http://127.0.0.1:8000/health` should report
`{"status":"ok", "python":"…", "java":"available"}`.

## Deployment (Vercel)

Everything deploys to **Vercel as a single project**: the static React frontend
plus a Python serverless function that runs the engine.

| Endpoint | Runs on Vercel? |
|---|---|
| `POST /api/extract-graph` | ✅ Pure `ast` parsing, no execution |
| `POST /api/execute` (Python, Learning + Trace) | ✅ |
| `POST /api/execute-java` | ❌ Vercel ships no JDK |

Vercel provides Python but **no JDK**, so Java cannot run there. The engine
detects this and reports it:

```json
{ "status": "ok", "java": "unavailable", "languages": ["python"] }
```

The frontend probes `/health` on load and **hides the Java option** when the
engine reports it cannot run Java, so it is never selectable only to fail.
Locally, with a JDK installed, `/health` reports `["python", "java"]` and the
Java button appears as usual — nothing changes for local development.

### Deploying

1. Import the repository into Vercel.
2. Set one environment variable (Project → Settings → Environment Variables):

   ```
   VITE_ENGINE_URL = /api
   ```

3. Deploy. `vercel.json` handles the rest:

   - builds the frontend with `npm run build` into `dist/`,
   - serves the Python function from `api/index.py` at `/api/*`,
   - rewrites all non-`/api` routes to `index.html` for the SPA,
   - gives the function 60s / 1 GB (enough for Python traces).

Verify with `https://<your-app>.vercel.app/api/health`.

### How the two stay connected

The frontend reads `VITE_ENGINE_URL` at **build time** (see
`src/engine/executor.ts`). With it set to `/api`, requests go to the same origin
as the app, so there is no CORS setup and no second deployment to manage.
`.env.example` documents the options; if the variable is unset the frontend
falls back to the local engine at `http://127.0.0.1:8000`.

### Engine notes

- **Entry-point blocks run.** Code is executed with `__name__ = "__main__"`, so a
  student's usual `if __name__ == "__main__":` block actually executes. Without
  it, `exec()` resolves `__name__` to `"builtins"`, the condition is false, and
  the program is silently skipped.
- **Windows event loop.** On Windows the engine selects asyncio's
  `WindowsSelectorEventLoopPolicy`. uvicorn otherwise uses the proactor loop,
  whose `accept()` raises `WinError 64` when a client disconnects abruptly —
  which killed the whole server. The selector loop is not affected.

## Testing

Run with the engine running:

```bash
npx vitest run --no-file-parallelism
```

`--no-file-parallelism` is recommended: the test files hit the shared engine,
and running them sequentially avoids contending for it. The suite covers:

- **All 21 catalog algorithms end-to-end in both Python and Java.**
- Correct search results (BFS path, UCS/A\* cost 418 on the Romania map,
  sorted bubble-sort output).
- Trace mode (`STEP` events with line numbers) for Python and Java (JDI).
- Infinite-loop guards in both modes and runtime-error capture.
- UI workflows (catalog switching, run, stepping, theme, modals, compare).

Build / lint:

```bash
npm run build            # tsc -b && vite build
npm run lint             # oxlint (0 errors)
```

## Verification checklist

- [x] **Editor** — Monaco editor loads the selected algorithm's code; switching
      language swaps Python ↔ Java source; active line and error line are
      highlighted; clicking a console error scrolls the editor to that line.
- [x] **Language selector** — Python and Java only (no JavaScript). Selecting a
      language reloads the code for the current algorithm.
- [x] **Run button** — compiles/executes the code and produces real events;
      Stop halts playback; Reset returns the timeline to the start.
- [x] **Graph renderer** — renders nodes/edges from the current input and
      highlights visited nodes, traversed edges, final path, and per-node costs
      from the execution snapshot; sorting/tree/hash targets render their own
      views.
- [x] **Graph from code** — pasting code that defines an adjacency list and
      pressing Run (or **Use Graph from Code**) rebuilds the canvas from that
      graph, auto-detecting `START`/`GOAL` and laying the nodes out; verified
      with a 9-node/20-edge Pakistan map (extracted, run, and path-highlighted).
- [x] **Graph import validation** — importing malformed graph JSON shows a
      clear error instead of rendering a broken canvas.
- [x] **Step controls** — play, pause, step forward, step backward, jump to an
      arbitrary step, speed control, and reset all drive the renderer in sync
      with the captured events.
- [x] **Catalog** — all 21 algorithms have working Python *and* Java samples.
- [x] **Error handling** — syntax/runtime errors surface with messages; infinite
      loops are bounded instead of hanging the engine.
- [x] **No JavaScript remnants** — no JS engine, worker, instrumenter, or
      `defaultCode` fields remain.
