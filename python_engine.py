"""
SearchLab Execution Engine
==========================

A single local FastAPI service (default http://127.0.0.1:8000) that executes
algorithm source code and records structured execution events for the graph
visualizer.

Supported languages
-------------------
* Python  - executed in-process with a ``sys.settrace`` tracer so every executed
            source line produces a STEP event (locals + call stack). Algorithm
            code may additionally call the ``visualizer`` API to emit semantic
            graph/array/tree events.
* Java    - compiled with ``javac`` and executed either
            (a) normally with the bundled ``SearchLab`` runtime, which records
                semantic events, or
            (b) under the bundled JDI tracer (``JavaTracer``) which records one
                STEP event per executed line, with locals and call stack.

Endpoints
---------
GET  /                 service description
GET  /health           health probe
POST /execute          execute Python source
POST /execute-java     execute Java source
POST /extract-graph    extract a graph defined inside source code

There is intentionally no JavaScript support.
"""

import ast
import collections.abc
import copy
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
import traceback
from io import StringIO
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

app = FastAPI(title="SearchLab Execution Engine")

# Allowed browser origins. `*` is fine for a public API that runs no ambient
# auth; set SEARCHLAB_ALLOWED_ORIGINS (comma-separated) to lock it to your
# deployed frontend, e.g. "https://searchlab.vercel.app".
_allowed_origins_env = os.environ.get("SEARCHLAB_ALLOWED_ORIGINS", "").strip()
_allowed_origins = (
    [origin.strip() for origin in _allowed_origins_env.split(",") if origin.strip()]
    if _allowed_origins_env else ["*"]
)

# Credentials cannot be combined with a wildcard origin, so only enable them
# when explicit origins were configured.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=_allowed_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def _validation_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    """Return the standard SearchLab error envelope for malformed requests.

    Without this, FastAPI would answer with ``{"detail": [...]}`` which the
    frontend executor cannot surface as a runtime error.
    """
    message = "; ".join(
        f"{'.'.join(str(p) for p in err.get('loc', []))}: {err.get('msg')}"
        for err in exc.errors()
    ) or "Invalid request payload."
    return JSONResponse(status_code=422, content={
        "success": False,
        "events": [],
        "error": {"message": message, "line": None, "stack": None},
        "totalSteps": 0,
        "durationMs": 0,
        "logs": [message],
    })

USER_FILENAME = "<user_code>"

# Hard wall-clock limit for a single Python execution. Guarantees that code
# which never calls the visualizer API (e.g. `while True: pass`) cannot hang a
# worker thread indefinitely.
PYTHON_WALL_LIMIT_SECONDS = 15.0

# Maximum number of nodes a graph auto-extracted from user code may contain.
MAX_EXTRACTED_NODES = 120

# Directory containing the bundled Java sources / compiled classes.
JAVA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "java_engine")
JAVA_CLASSES = os.path.join(JAVA_DIR, "classes")


# ---------------------------------------------------------------------------
# Graph extraction (turn a graph defined inside user code into canvas data)
# ---------------------------------------------------------------------------

def _node_safe_str(value: Any) -> str:
    """Convert a node key (str / int / tuple) into a stable string id."""
    if isinstance(value, str):
        return value
    if isinstance(value, bool):
        return str(value)
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        return str(int(value)) if value.is_integer() else str(value)
    if isinstance(value, (tuple, list)):
        return "_".join(_node_safe_str(v) for v in value)
    return str(value)


def _build_graph_dict(adjacency: Any) -> tuple:
    """Normalise a mapping of ``node -> neighbours`` into ``(nodes, edges)``.

    Neighbours may be:
      * ``{'B': 10}``                     dict of node -> weight
      * ``[('B', 10), ('C', 20)]``        list of (node, weight) pairs
      * ``[[('B', 10), ('C', 20)], ...]`` matrix rows (each row is a list of
                                          ``(node, weight)`` pairs)
      * ``['B', 'C']``                    plain list of node names
    Returns ``(nodes, edges, start, goal)`` where node ids are strings.
    """
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    seen: Dict[str, int] = {}
    edge_keys = set()

    def add_node(raw: Any) -> str:
        nid = _node_safe_str(raw)
        if nid not in seen:
            seen[nid] = len(nodes)
            nodes.append({"id": nid, "label": nid})
        return nid

    def add_edge(src: str, dst: Any, weight: Any) -> None:
        # A tuple/list "weight" means this entry is NOT a (node, weight) pair
        # (e.g. a dict entry whose value is a list of neighbours). Skip it.
        if isinstance(weight, (dict, list, tuple, set)):
            return
        if weight is None:
            weight = 1
        try:
            cost: Any = float(weight)
            if cost.is_integer():
                cost = int(cost)
        except (TypeError, ValueError):
            cost = 1
        dst_id = add_node(dst)
        key = (src, dst_id, str(cost))
        if key in edge_keys:
            return
        edge_keys.add(key)
        edges.append({
            "id": f"e{len(edges) + 1}",
            "from": src,
            "to": dst_id,
            "cost": cost,
            "directed": False,
        })

    for raw_src, raw_neighbours in adjacency.items():
        src = add_node(raw_src)
        if raw_neighbours is None:
            continue
        iterable: Any = raw_neighbours
        # Flatten one level: dict / list / matrix rows -> list of entries.
        if isinstance(iterable, collections.abc.Mapping):
            iterable = list(iterable.items())
        elif isinstance(iterable, (list, tuple)):
            flat: List[Any] = []
            for item in iterable:
                if isinstance(item, (list, tuple)) and len(item) == 2 \
                        and not isinstance(item[1], (list, tuple, dict, set)):
                    flat.append(item)
                elif isinstance(item, (list, tuple)):
                    flat.extend(item)
                else:
                    flat.append(item)
            iterable = flat

        if not isinstance(iterable, (list, tuple)):
            continue
        for entry in iterable:
            if isinstance(entry, (list, tuple)) and len(entry) == 2:
                add_edge(src, entry[0], entry[1])
            elif not isinstance(entry, (list, tuple, dict, set)):
                add_edge(src, entry, 1)
            # Anything else (nested/irregular literal) is ignored rather than
            # raising, so plain non-graph dicts simply produce no edges.

    return nodes, edges


def _constant_value(node: ast.AST) -> Any:
    """Best-effort static evaluation for graph literals (dict/list/tuple/scalars)."""
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, ast.Name) and node.id in ("True", "False", "None"):
        return {"True": True, "False": False, "None": None}[node.id]
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
        value = _constant_value(node.operand)
        if isinstance(value, (int, float)):
            return -value
        return None
    if isinstance(node, ast.Dict):
        out: Dict[Any, Any] = {}
        for key_node, value_node in zip(node.keys, node.values):
            key = _constant_value(key_node)
            value = _constant_value(value_node)
            if key is None or value is None:
                continue
            out[key] = value
        return out
    if isinstance(node, (ast.List, ast.Tuple)):
        return [_constant_value(element) for element in node.elts]
    return None


def _humanize(identifier: str) -> str:
    text = identifier.strip("_")
    return text.replace("_", " ").strip() or identifier


def _find_start_goal(tree: ast.AST) -> tuple:
    """Find ``START``/``GOAL`` assignments in the module (e.g. START = 'Karachi')."""
    start: Optional[str] = None
    goal: Optional[str] = None
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    if target.id.upper() == "START":
                        value = _constant_value(node.value)
                        if value is not None:
                            start = _node_safe_str(value)
                    elif target.id.upper() == "GOAL":
                        value = _constant_value(node.value)
                        if value is not None:
                            goal = _node_safe_str(value)
    return start, goal


def extract_graph(code: str) -> Dict[str, Any]:
    """Extract a graph defined inside source code.

    Parses the code with :mod:`ast` and looks for a top-level assignment whose
    right-hand side is a mapping of ``node -> neighbours`` (an adjacency list).
    Returns a dict ``{found, nodes, edges, startNodeId, goalNodeId, source}`` or
    ``{found: False}`` when nothing graph-like is present.
    """
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return {"found": False}

    candidates: List[tuple] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and isinstance(node.value, ast.Dict):
            adjacency = _constant_value(node.value)
            if isinstance(adjacency, dict) and adjacency:
                names = [t.id for t in node.targets if isinstance(t, ast.Name)]
                candidates.append((names[0] if names else "", adjacency))

    if not candidates:
        return {"found": False}

    # Prefer the largest adjacency list (most nodes then most edges).
    def _size(item: tuple) -> tuple:
        name, adjacency = item
        edges = sum(len(v) if isinstance(v, (list, tuple, dict)) else 0
                    for v in adjacency.values())
        return (len(adjacency), edges)

    name, adjacency = max(candidates, key=_size)
    nodes, edges = _build_graph_dict(adjacency)
    # Require a plausibly graph-shaped literal. A single-entry or two-entry
    # dict (common in unrelated config data) should not be mistaken for a graph.
    if len(nodes) < 3 or len(edges) < 2:
        return {"found": False}

    start, goal = _find_start_goal(tree)
    ids = [n["id"] for n in nodes]
    if start not in ids:
        start = None
    if goal not in ids:
        goal = None

    return {
        "found": True,
        "nodes": nodes,
        "edges": edges,
        "startNodeId": start or ids[0],
        "goalNodeId": goal or ids[-1],
        "startDetected": start is not None,
        "goalDetected": goal is not None,
        "source": _humanize(name) if name else "graph",
    }


def _uses_visualizer_api(code: str) -> bool:
    """Return True if *code* calls into the visualizer API.

    Student programs are free to ignore the ``visualizer.*`` helpers
    completely. Detecting that lets Learning Mode fall back to deriving the
    graph state from the traced locals, exactly like Trace Mode, so pasted
    code still animates the Interactive Visualization Canvas.

    The check is purely syntactic (it never executes user code): any attribute
    access on ``visualizer`` / ``v``, or a bare ``visualizer`` / ``v`` name,
    counts as API use.
    """
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return False
    for node in ast.walk(tree):
        if isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name):
            if node.value.id in ("visualizer", "v"):
                return True
        if isinstance(node, ast.Name) and node.id == "visualizer":
            return True
    return False


def validate_pasted_graph(graph: Any) -> List[str]:
    """Return a list of validation errors for an imported/pasted graph."""
    errors: List[str] = []
    if not isinstance(graph, dict):
        return ["Graph must be a JSON object."]
    nodes = graph.get("nodes")
    edges = graph.get("edges")
    if not isinstance(nodes, list) or not nodes:
        return ["Graph must contain a non-empty 'nodes' array."]
    if not isinstance(edges, list):
        return ["Graph must contain an 'edges' array."]

    ids: List[str] = []
    for index, node in enumerate(nodes):
        if not isinstance(node, dict):
            errors.append(f"Node {index} is not an object.")
            continue
        node_id = node.get("id")
        if not isinstance(node_id, str) or not node_id:
            errors.append(f"Node {index} is missing a string 'id'.")
            continue
        ids.append(node_id)
        for coord in ("x", "y"):
            value = node.get(coord)
            if not isinstance(value, (int, float)):
                errors.append(f'Node "{node_id}" has a non-numeric {coord}.')
    if len(set(ids)) != len(ids):
        errors.append("Node ids must be unique.")

    id_set = set(ids)
    for index, edge in enumerate(edges):
        if not isinstance(edge, dict):
            errors.append(f"Edge {index} is not an object.")
            continue
        for endpoint in ("from", "to"):
            value = edge.get(endpoint)
            if value not in id_set:
                errors.append(
                    f'Edge {index} references unknown {endpoint} "{value}".')
        cost = edge.get("cost")
        if not isinstance(cost, (int, float)):
            errors.append(f"Edge {index} has a non-numeric 'cost'.")

    for endpoint in ("startNodeId", "goalNodeId"):
        value = graph.get(endpoint)
        if value is not None and value not in id_set:
            errors.append(f'"{endpoint}" references unknown node "{value}".')

    if len(ids) > MAX_EXTRACTED_NODES:
        errors.append(
            f"Graph has {len(ids)} nodes; the visualizer supports at most "
            f"{MAX_EXTRACTED_NODES}.")

    if errors:
        return errors

    # Note: validation intentionally does not reject cycles. Cyclic graphs are
    # valid inputs for many algorithms (e.g. traversal over a general graph), so
    # a cycle check here previously ran only to have its result discarded.
    return []


# ---------------------------------------------------------------------------
# Snapshot model
# ---------------------------------------------------------------------------

def _initial_snapshot(initial_data: Any) -> Dict[str, Any]:
    return {
        "dataStructure": copy.deepcopy(initial_data),
        "variables": {},
        "callStack": [],
        "activeIndices": [],
        "secondaryIndices": [],
        "activeNodes": [],
        "visitedNodes": [],
        "activeEdges": [],
        "finalPath": [],
        "queueItems": [],
        "stackItems": [],
        "metrics": {
            "comparisons": 0,
            "swaps": 0,
            "writes": 0,
            "nodesVisited": 0,
            "edgesTraversed": 0,
            "timeElapsedMs": 0,
        },
        "consoleLogs": [],
    }


def apply_event(snapshot: Dict[str, Any], event_type: str, data: Any, logs: List[str]) -> None:
    """Mutate ``snapshot`` to reflect a single event.

    Shared by the Python recorder, the Python tracer and the Java record/steps
    mappers so all three produce identical snapshot semantics.
    """
    data = data or {}
    metrics = snapshot["metrics"]

    if event_type == "ARRAY_COMPARED":
        snapshot["activeIndices"] = [data.get("i"), data.get("j")]
        metrics["comparisons"] += 1
        if data.get("array") is not None:
            snapshot["dataStructure"] = data["array"]

    elif event_type == "ARRAY_SWAPPED":
        snapshot["activeIndices"] = [data.get("i"), data.get("j")]
        metrics["swaps"] += 1
        if data.get("newArray") is not None:
            snapshot["dataStructure"] = data["newArray"]
        elif data.get("array") is not None:
            snapshot["dataStructure"] = data["array"]

    elif event_type == "ARRAY_WRITTEN":
        snapshot["activeIndices"] = [data.get("index")]
        metrics["writes"] += 1
        if data.get("newArray") is not None:
            snapshot["dataStructure"] = data["newArray"]
        elif data.get("array") is not None:
            snapshot["dataStructure"] = data["array"]

    elif event_type == "ARRAY_PIVOT":
        snapshot["secondaryIndices"] = [data.get("index")]

    elif event_type == "SUBARRAY_FOCUSED":
        if data.get("index") is not None:
            snapshot["activeIndices"] = [data["index"]]

    elif event_type == "ELEMENT_FOUND":
        if data.get("index") is not None:
            snapshot["activeIndices"] = [data["index"]]

    elif event_type == "NODE_SELECTED":
        snapshot["activeNodes"] = [data.get("nodeId")]

    elif event_type == "NODE_EXPANDED":
        node_id = data.get("nodeId")
        if node_id is not None and node_id not in snapshot["visitedNodes"]:
            snapshot["visitedNodes"].append(node_id)
            metrics["nodesVisited"] += 1
        snapshot["activeNodes"] = [node_id]

    elif event_type == "EDGE_RELAXED":
        snapshot["activeEdges"] = [[data.get("from"), data.get("to")]]
        metrics["edgesTraversed"] += 1

    elif event_type == "COST_UPDATED":
        costs = snapshot["variables"].setdefault("costs", {})
        if isinstance(costs, dict):
            costs[data.get("nodeId")] = data.get("cost")

    elif event_type == "QUEUE_UPDATED":
        snapshot["queueItems"] = copy.deepcopy(data.get("items", snapshot["queueItems"]))
        metrics["queueSize"] = len(snapshot["queueItems"])

    elif event_type == "STACK_UPDATED":
        snapshot["stackItems"] = copy.deepcopy(data.get("items", snapshot["stackItems"]))

    elif event_type == "GOAL_FOUND":
        snapshot["finalPath"] = list(data.get("path") or [])
        if data.get("totalCost") is not None:
            metrics["pathCost"] = data["totalCost"]

    elif event_type == "TREE_VISITED":
        node = data.get("node")
        if node is not None and node not in snapshot["visitedNodes"]:
            snapshot["visitedNodes"].append(node)
            metrics["nodesVisited"] += 1
        snapshot["activeNodes"] = [node]

    elif event_type == "HASH_INSERTED":
        keys = snapshot["variables"].setdefault("hashKeys", [])
        if isinstance(keys, list):
            keys.append(data.get("key"))

    elif event_type == "ALGORITHM_COMPLETED":
        snapshot["activeIndices"] = []
        snapshot["activeNodes"] = []
        snapshot["activeEdges"] = []

    elif event_type == "LOG_MESSAGE":
        message = data.get("message")
        if message is not None and message not in logs:
            logs.append(str(message))

    elif event_type == "STEP":
        locals_map = data.get("locals") or {}
        for key, value in locals_map.items():
            snapshot["variables"][key] = value
        snapshot["callStack"] = data.get("callStack") or []


class Recorder:
    """Collects events + immutable snapshots for one execution."""

    def __init__(self, initial_data: Any, max_events: int = 20000):
        self.max_events = max_events
        self.start_time = time.perf_counter()
        self.events: List[Dict[str, Any]] = []
        self.logs: List[str] = []
        self.snapshot = _initial_snapshot(initial_data)
        self.snapshot["consoleLogs"] = self.logs

    # -- core ---------------------------------------------------------------

    def emit(self, event_type: str, description: str, data: Any = None,
             line: Optional[int] = None) -> None:
        if len(self.events) >= self.max_events:
            raise RuntimeError(
                f"Execution exceeded maximum event limit of {self.max_events}. "
                "Possible infinite loop!"
            )

        apply_event(self.snapshot, event_type, data, self.logs)

        elapsed = int((time.perf_counter() - self.start_time) * 1000)
        self.snapshot["metrics"]["timeElapsedMs"] = elapsed

        self.events.append({
            "id": len(self.events),
            "type": event_type,
            "line": line,
            "timestamp": elapsed,
            "description": description,
            "data": copy.deepcopy(data),
            "stateSnapshot": copy.deepcopy(self.snapshot),
        })

    # -- Python visualizer API ---------------------------------------------

    def compare(self, i: int, j: int, line: Optional[int] = None) -> bool:
        arr = self.snapshot["dataStructure"]
        val_a = arr[i] if isinstance(arr, list) and 0 <= i < len(arr) else None
        val_b = arr[j] if isinstance(arr, list) and 0 <= j < len(arr) else None
        self.emit("ARRAY_COMPARED",
                  f"Compared index {i} ({val_a}) and index {j} ({val_b})",
                  {"i": i, "j": j, "valA": val_a, "valB": val_b}, line)
        return (val_a > val_b) if (val_a is not None and val_b is not None) else False

    def swap(self, i: int, j: int, line: Optional[int] = None) -> None:
        arr = self.snapshot["dataStructure"]
        if isinstance(arr, list) and 0 <= i < len(arr) and 0 <= j < len(arr):
            arr[i], arr[j] = arr[j], arr[i]
        self.emit("ARRAY_SWAPPED", f"Swapped elements at index {i} and {j}",
                  {"i": i, "j": j, "newArray": copy.deepcopy(arr)}, line)

    def write(self, index: int, value: Any, line: Optional[int] = None) -> None:
        arr = self.snapshot["dataStructure"]
        if isinstance(arr, list) and 0 <= index < len(arr):
            arr[index] = value
        self.emit("ARRAY_WRITTEN", f"Wrote value {value} to index {index}",
                  {"index": index, "value": value, "newArray": copy.deepcopy(arr)}, line)

    def set_pivot(self, index: int, line: Optional[int] = None) -> None:
        self.emit("ARRAY_PIVOT", f"Selected pivot at index {index}", {"index": index}, line)

    setPivot = set_pivot

    def set_subarray(self, left: int, right: int, line: Optional[int] = None) -> None:
        self.emit("SUBARRAY_FOCUSED", f"Focusing subarray range [{left} ... {right}]",
                  {"left": left, "right": right}, line)

    setSubarray = set_subarray

    def select_node(self, node_id: str, line: Optional[int] = None) -> None:
        self.emit("NODE_SELECTED", f'Selected node "{node_id}"', {"nodeId": node_id}, line)

    selectNode = select_node

    def visit_node(self, node_id: str, line: Optional[int] = None) -> None:
        self.emit("NODE_EXPANDED", f'Visited/Expanded node "{node_id}"',
                  {"nodeId": node_id}, line)

    visitNode = visit_node

    def discover_node(self, node_id: str, cost: Optional[float] = None,
                      line: Optional[int] = None) -> None:
        desc = f'Discovered node "{node_id}"' + (f" with cost {cost}" if cost is not None else "")
        self.emit("NODE_DISCOVERED", desc, {"nodeId": node_id, "cost": cost}, line)

    discoverNode = discover_node

    def traverse_edge(self, u: str, v: str, cost: Optional[float] = None,
                      line: Optional[int] = None) -> None:
        desc = f"Traversed edge ({u} -> {v})" + (f" with weight {cost}" if cost is not None else "")
        self.emit("EDGE_RELAXED", desc, {"from": u, "to": v, "cost": cost}, line)

    traverseEdge = traverse_edge

    def update_cost(self, node_id: str, cost: float, line: Optional[int] = None) -> None:
        self.emit("COST_UPDATED", f'Updated best cost for node "{node_id}" to {cost}',
                  {"nodeId": node_id, "cost": cost}, line)

    updateCost = update_cost

    def update_queue(self, items: List[Any], line: Optional[int] = None) -> None:
        self.emit("QUEUE_UPDATED", f"Updated queue ({len(items)} items)", {"items": items}, line)

    updateQueue = update_queue

    def mark_path(self, path: List[str], total_cost: Optional[float] = None,
                  line: Optional[int] = None) -> None:
        desc = f"Found path: {' -> '.join(path)}" + (
            f" (Cost: {total_cost})" if total_cost is not None else "")
        self.emit("GOAL_FOUND", desc, {"path": path, "totalCost": total_cost}, line)

    markPath = mark_path

    def set_variable(self, name: str, value: Any, line: Optional[int] = None) -> None:
        self.snapshot["variables"][name] = copy.deepcopy(value)

    setVariable = set_variable

    def visit_tree_node(self, node_id: str, value: Any = None,
                        line: Optional[int] = None) -> None:
        self.emit("TREE_VISITED", f"Visited tree node {node_id} (value {value})",
                  {"node": node_id, "value": value}, line)

    visitTreeNode = visit_tree_node

    def insert_tree_node(self, node_id: str, value: Any = None, parent_id: Any = None,
                         line: Optional[int] = None) -> None:
        self.emit("TREE_INSERTED", f"Inserted tree node {node_id} (value {value})",
                  {"node": node_id, "value": value, "parent": parent_id}, line)

    insertTreeNode = insert_tree_node

    def hash_insert(self, key: Any, bucket_index: Any = None,
                    line: Optional[int] = None) -> None:
        self.emit("HASH_INSERTED", f"Inserted key {key} into bucket {bucket_index}",
                  {"key": key, "bucket": bucket_index}, line)

    hashInsert = hash_insert

    def hash_collision(self, key: Any, bucket_index: Any = None,
                       line: Optional[int] = None) -> None:
        self.emit("HASH_COLLISION", f"Collision for key {key} at bucket {bucket_index}",
                  {"key": key, "bucket": bucket_index}, line)

    hashCollision = hash_collision

    def log(self, message: Any, line: Optional[int] = None) -> None:
        self.emit("LOG_MESSAGE", str(message), {"message": str(message)}, line)

    def complete(self, result: Any = None, line: Optional[int] = None) -> None:
        self.emit("ALGORITHM_COMPLETED", "Algorithm completed successfully",
                  {"result": result}, line)


# ---------------------------------------------------------------------------
# Python tracing (sys.settrace -> one STEP event per executed line)
# ---------------------------------------------------------------------------

def _safe(value: Any, depth: int = 0) -> Any:
    if depth > 3:
        return repr(value)[:300]
    if value is None or isinstance(value, (bool, int, str)):
        return value
    if isinstance(value, float):
        if value != value or value in (float("inf"), float("-inf")):
            return str(value)
        return value
    if isinstance(value, (list, tuple)):
        return [_safe(v, depth + 1) for v in list(value)[:200]]
    if isinstance(value, set):
        return [_safe(v, depth + 1) for v in list(value)[:200]]
    if isinstance(value, dict):
        out: Dict[str, Any] = {}
        for k, v in list(value.items())[:200]:
            out[str(k)] = _safe(v, depth + 1)
        return out
    return repr(value)[:300]


_SKIP_LOCALS = {"visualizer", "v", "input", "data", "__builtins__", "print", "__name__",
                "__doc__", "__package__", "__loader__", "__spec__"}


# ---------------------------------------------------------------------------
# Automatic graph visualisation from traced local variables (Trace mode)
# ---------------------------------------------------------------------------
#
# A student's own search code rarely calls the `visualizer.*` API. In Trace mode
# we therefore *derive* the graph state from the locals seen at every executed
# line so the Interactive Visualization Canvas still animates the algorithm:
#
#   * the node currently being expanded  (a local such as `node`/`current`/`u`)
#   * the set of visited/explored nodes  (a local such as `visited`/`explored`)
#   * the edge currently being traversed (a `(u, v)` local pair or `parent`)
#   * the final path                     (a list local such as `path`)
#
# The derivation is intentionally conservative: a value only counts as a graph
# node when it matches a node id/label of the graph being visualised.

# Local names that commonly hold "the node we are looking at right now".
_ACTIVE_NODE_NAMES = (
    "node", "current", "current_node", "curr", "u", "vertex", "city", "state",
)
# Local names that commonly hold the collection of already-visited nodes.
_VISITED_NAMES = ("visited", "explored", "seen", "closed", "discovered", "settled")
# Local names that commonly hold a frontier/queue (used as a weaker signal).
_FRONTIER_NAMES = ("frontier", "queue", "open_set", "openset", "agenda", "stack")
# Local names that commonly hold a node -> parent mapping.
_PARENT_NAMES = ("parent", "parents", "prev", "previous", "came_from", "camefrom")
# Local names that commonly hold the discovered path.
_PATH_NAMES = ("path", "route", "solution", "shortest_path", "result_path")


class GraphStateTracker:
    """Derive graph highlighting from traced locals when no API calls are made.

    Constructed once per execution with the node ids (and labels) of the graph
    that is being visualised. It is deliberately forgiving: any local value that
    matches a known node becomes a candidate, and only unambiguous, plausible
    signals are promoted to snapshot state.
    """

    def __init__(self, graph_nodes: Any):
        self.node_ids: set = set()
        self.label_to_id: Dict[str, str] = {}
        if isinstance(graph_nodes, (list, tuple)):
            for node in graph_nodes:
                if isinstance(node, dict) and node.get("id") is not None:
                    node_id = str(node["id"])
                    self.node_ids.add(node_id)
                    label = node.get("label")
                    if label is not None:
                        self.label_to_id[str(label)] = node_id
                        # Also accept an identifier-friendly form of the label
                        # so code such as "Rimnicu_Vilcea" still matches the
                        # label "Rimnicu Vilcea".
                        self.label_to_id.setdefault(
                            str(label).replace(" ", "_"), node_id)
        elif isinstance(graph_nodes, (set,)):
            self.node_ids = {str(n) for n in graph_nodes}
        self.enabled = len(self.node_ids) > 0

    # -- helpers ------------------------------------------------------------

    def _as_node(self, value: Any) -> Optional[str]:
        """Return the graph node id for *value*, or ``None`` if it is not one."""
        if isinstance(value, bool):
            return None
        if isinstance(value, (str, int)):
            text = str(value)
            if text in self.node_ids:
                return text
            return self.label_to_id.get(text)
        return None

    def _node_sequence(self, value: Any) -> Optional[List[str]]:
        """Map a list/tuple/set of node-like values to graph node ids."""
        if isinstance(value, (list, tuple, set, frozenset)):
            items = list(value)
            # Sets of tuples (e.g. visited edge-pairs) are not node sequences.
            if not items:
                return None
            mapped = [self._as_node(item) for item in items]
            if all(m is not None for m in mapped) and len(set(mapped)) == len(mapped):
                return [m for m in mapped if m is not None]
        return None

    # -- public -------------------------------------------------------------

    def derive(self, locals_map: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Return ``{visited, active, edges, path}`` derived from locals.

        ``None`` means "nothing useful found at this step". Only keys that
        actually carry information are included so the caller can merge them
        into the snapshot without clobbering state from other events.
        """
        if not self.enabled or not isinstance(locals_map, dict):
            return None

        result: Dict[str, Any] = {}

        # 1. Visited / explored collection.
        visited: Optional[List[str]] = None
        for name in _VISITED_NAMES:
            if name in locals_map:
                candidate = self._node_sequence(locals_map[name])
                if candidate is not None:
                    visited = candidate
                    break
        if visited is None:
            # Frontier contents count as "discovered" (but not fully visited).
            for name in _FRONTIER_NAMES:
                if name in locals_map:
                    candidate = self._node_sequence(locals_map[name])
                    if candidate is not None:
                        visited = candidate
                        break

        # 2. Active node.
        active: Optional[str] = None
        for name in _ACTIVE_NODE_NAMES:
            if name in locals_map:
                active = self._as_node(locals_map[name])
                if active is not None:
                    break
        if active is None:
            # Fall back to the deepest node on a `path`-like list.
            for name in _PATH_NAMES:
                if name in locals_map:
                    seq = self._node_sequence(locals_map[name])
                    if seq:
                        active = seq[-1]
                        break

        # 3. Active edge: from a parent mapping or a co-located (u, v) pair.
        edge: Optional[List[str]] = None
        for name in _PARENT_NAMES:
            parent_map = locals_map.get(name)
            if isinstance(parent_map, dict) and active is not None:
                parent = self._as_node(parent_map.get(active))
                if parent is not None and parent != active:
                    edge = [parent, active]
                    break
        if edge is None and active is not None:
            for other in ("v", "neighbor", "neighbour", "next_node", "next"):
                if other in locals_map:
                    other_id = self._as_node(locals_map[other])
                    if other_id is not None and other_id != active:
                        edge = [active, other_id]
                        break

        # 4. Final path.
        path: Optional[List[str]] = None
        for name in _PATH_NAMES:
            if name in locals_map:
                candidate = self._node_sequence(locals_map[name])
                if candidate is not None and len(candidate) >= 2:
                    path = candidate
                    break

        if visited is not None:
            result["visited"] = visited
        if active is not None:
            result["active"] = active
        if edge is not None:
            result["edge"] = edge
        if path is not None:
            result["path"] = path

        return result or None


def _graph_state_event(derived: Dict[str, Any], line: Optional[int]) -> tuple:
    """Turn derived graph state into a synthetic event type + payload.

    Returns ``(event_type, data)``. Priority mirrors how a student reads the
    visualisation: a completed path beats a single edge, which beats a node.
    """
    if derived.get("path"):
        path = derived["path"]
        return "GOAL_FOUND", {"path": path}
    if derived.get("edge"):
        edge = derived["edge"]
        return "EDGE_RELAXED", {"from": edge[0], "to": edge[1]}
    if derived.get("active") is not None:
        return "NODE_EXPANDED", {"nodeId": derived["active"]}
    if derived.get("visited"):
        # Report the most recently added node as the active one.
        return "NODE_EXPANDED", {"nodeId": derived["visited"][-1]}
    return None, None



def _make_tracer(recorder: Recorder, emit_steps: bool = True,
                 deadline: Optional[float] = None,
                 graph_tracker: Optional["GraphStateTracker"] = None,
                 emit_graph_state: bool = False):
    """Build a :func:`sys.settrace` function.

    ``emit_steps`` controls whether per-line ``STEP`` records are produced
    (Mode B). Regardless of the mode a wall-clock ``deadline`` is enforced so
    that an infinite loop which never calls the visualizer API is still
    stopped instead of hanging the worker thread forever.

    When ``emit_graph_state`` is set and a ``graph_tracker`` is supplied, each
    executed line is also inspected for graph-relevant locals (the node being
    expanded, the visited set, the current edge, the path) and a synthetic
    ``NODE_EXPANDED`` / ``EDGE_RELAXED`` / ``GOAL_FOUND`` event is recorded.
    This is what makes a student's *own* search code light up the Interactive
    Visualization Canvas without them calling the ``visualizer.*`` API.
    """

    def _check_deadline() -> None:
        if deadline is not None and time.perf_counter() > deadline:
            raise TimeoutError(
                "Execution exceeded the time limit (possible infinite loop).")

    # Remember what we have already reported so we emit only *changes*.
    last_visited_count = 0
    last_active: Optional[str] = None
    last_edge: Optional[tuple] = None
    last_path: Optional[tuple] = None

    def _emit_graph_state(locals_map: Dict[str, Any], line: Optional[int]) -> None:
        nonlocal last_visited_count, last_active, last_edge, last_path
        if graph_tracker is None:
            return
        derived = graph_tracker.derive(locals_map)
        if not derived:
            return

        # Path completion is the most significant signal - report the change.
        path = derived.get("path")
        if path:
            path_key = tuple(path)
            if path_key != last_path:
                last_path = path_key
                recorder.emit("GOAL_FOUND", f"Found path: {' -> '.join(path)}",
                              {"path": path}, line)
                return

        # Then the edge currently under consideration.
        edge = derived.get("edge")
        if edge:
            edge_key = (edge[0], edge[1])
            if edge_key != last_edge:
                last_edge = edge_key
                recorder.emit("EDGE_RELAXED",
                              f"Traversed edge ({edge[0]} -> {edge[1]})",
                              {"from": edge[0], "to": edge[1]}, line)

        # Then the active node.
        active = derived.get("active")
        if active is not None and active != last_active:
            last_active = active
            recorder.emit("NODE_EXPANDED", f'Visited/Expanded node "{active}"',
                          {"nodeId": active}, line)

        # Finally, catch up on visited nodes we have not reported yet.
        visited = derived.get("visited") or []
        if len(visited) > last_visited_count:
            for node_id in visited[last_visited_count:]:
                if node_id != last_active:
                    recorder.emit("NODE_EXPANDED", f'Visited node "{node_id}"',
                                  {"nodeId": node_id}, line)
            last_visited_count = len(visited)

    def local_tracer(frame, event, arg):
        if event == "line":
            _check_deadline()
            snapshot_locals: Dict[str, Any] = {}
            raw_locals: Dict[str, Any] = {}
            for key, value in frame.f_locals.items():
                if key in _SKIP_LOCALS or callable(value) or isinstance(value, type):
                    continue
                raw_locals[key] = value
                snapshot_locals[key] = _safe(value)

            if emit_steps:
                call_stack: List[str] = []
                frame_ptr = frame
                while frame_ptr is not None and len(call_stack) < 25:
                    if frame_ptr.f_code.co_filename == USER_FILENAME:
                        call_stack.append(
                            f"{frame_ptr.f_code.co_name} @ {frame_ptr.f_lineno}")
                    frame_ptr = frame_ptr.f_back

                recorder.emit(
                    "STEP", f"Line {frame.f_lineno}: {frame.f_code.co_name}",
                    {"locals": snapshot_locals, "callStack": call_stack}, frame.f_lineno)

            if emit_graph_state:
                _emit_graph_state(raw_locals, frame.f_lineno)
        elif event == "return" and emit_graph_state:
            # A statement on the final line of the program only becomes visible
            # in the locals on the *next* line event, which may never happen.
            # Deriving on return closes that gap (e.g. a trailing `path = [...]`).
            raw_locals = {
                key: value for key, value in frame.f_locals.items()
                if key not in _SKIP_LOCALS and not callable(value)
                and not isinstance(value, type)
            }
            _emit_graph_state(raw_locals, frame.f_lineno)
        return local_tracer

    def global_tracer(frame, event, arg):
        if frame.f_code.co_filename == USER_FILENAME:
            _check_deadline()
            return local_tracer
        return None

    return global_tracer


# ---------------------------------------------------------------------------
# Java toolchain
# ---------------------------------------------------------------------------

def _find_tool(name: str) -> Optional[str]:
    found = shutil.which(name)
    if found:
        return found
    candidates = [
        r"C:\Program Files\Common Files\Oracle\Java\javapath",
        r"C:\Program Files\Java",
    ]
    exe = name + (".exe" if os.name == "nt" else "")
    for base in candidates:
        direct = os.path.join(base, exe)
        if os.path.isfile(direct):
            return direct
        if os.path.isdir(base):
            for entry in os.listdir(base):
                nested = os.path.join(base, entry, "bin", exe)
                if os.path.isfile(nested):
                    return nested
    return None


JAVA = _find_tool("java")
JAVAC = _find_tool("javac")

# Guards the one-time compilation of the bundled runtime. FastAPI runs sync
# endpoints in a thread pool, so concurrent requests must not race here.
_JAVA_COMPILE_LOCK = threading.Lock()
_JAVA_COMPILED = False


def ensure_java_compiled(force: bool = False) -> None:
    """Compile the bundled Java runtime + tracer.

    Recompiles whenever a source file is newer than the compiled classes (or
    when ``force`` is set) so edits to ``SearchLab.java`` / ``JavaTracer.java``
    are always picked up.
    """
    if JAVA is None or JAVAC is None:
        raise RuntimeError(
            "A JDK was not found. Java execution requires 'javac' and 'java' on PATH.")
    sources = [os.path.join(JAVA_DIR, "SearchLab.java"),
               os.path.join(JAVA_DIR, "JavaTracer.java")]
    markers = [os.path.join(JAVA_CLASSES, "JavaTracer.class"),
               os.path.join(JAVA_CLASSES, "SearchLab.class")]
    global _JAVA_COMPILED
    with _JAVA_COMPILE_LOCK:
        if not force and _JAVA_COMPILED and all(os.path.isfile(m) for m in markers):
            return
        if not force and all(os.path.isfile(m) for m in markers):
            newest_source = max(os.path.getmtime(s) for s in sources)
            oldest_class = min(os.path.getmtime(m) for m in markers)
            if newest_source <= oldest_class:
                _JAVA_COMPILED = True
                return
        os.makedirs(JAVA_CLASSES, exist_ok=True)
        result = subprocess.run(
            [JAVAC, "-g", "-d", JAVA_CLASSES] + sources,
            capture_output=True, text=True, timeout=180)
        if result.returncode != 0:
            raise RuntimeError(
                "Failed to compile the bundled Java runtime:\n" + result.stderr)
        _JAVA_COMPILED = True


_JAVA_CLASS_RE = re.compile(r"\bpublic\s+(?:final\s+|abstract\s+)?class\s+(\w+)")
_JAVA_ANY_CLASS_RE = re.compile(r"\bclass\s+(\w+)")
_JAVA_PACKAGE_RE = re.compile(r"^\s*package\s+[\w.]+\s*;", re.MULTILINE)


def _java_class_name(code: str) -> Optional[str]:
    match = _JAVA_CLASS_RE.search(code) or _JAVA_ANY_CLASS_RE.search(code)
    return match.group(1) if match else None


def _java_error_line(stderr: str) -> Optional[int]:
    match = re.search(r":(\d+):\s*(?:error|warning):", stderr)
    if match:
        return int(match.group(1))
    return None


def _java_event_from_record(record: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "type": record.get("type", "LOG_MESSAGE"),
        "description": record.get("description", ""),
        "line": record.get("line"),
        "data": record.get("data"),
    }


def _build_from_java_records(records: List[Dict[str, Any]], initial_data: Any,
                             max_events: int) -> Recorder:
    recorder = Recorder(initial_data, max_events)
    for record in records:
        event_type = record.get("type", "LOG_MESSAGE")
        if event_type == "SET_VARIABLE":
            data = record.get("data") or {}
            recorder.snapshot["variables"][data.get("name")] = data.get("value")
            continue
        recorder.emit(event_type, record.get("description", ""),
                      record.get("data"), record.get("line"))
    return recorder


def _java_uses_visualizer_api(code: str) -> bool:
    """Return True if Java *code* calls into the bundled ``SearchLab`` API.

    Used (like :func:`_uses_visualizer_api` for Python) so Java Learning Mode
    can fall back to deriving graph state from the traced locals when the code
    never touches the API. Purely textual - it never compiles or runs anything.
    """
    return bool(re.search(r"\bSearchLab\s*\.\s*\w+|\bv\s*\.\s*(visitNode|traverseEdge|"
                          r"discoverNode|markPath|updateQueue|updateCost|log)\b", code))


def _build_from_java_steps(steps: List[Dict[str, Any]], records: List[Dict[str, Any]],
                           target_class: str, initial_data: Any, max_events: int,
                           emit_steps: bool = True) -> Recorder:
    """Merge JDI line steps with semantic runtime records (both from one run).

    As in the Python tracer, a student's own search code rarely calls the
    ``SearchLab`` API, so graph highlighting is *derived* from the locals seen
    at each line step. That keeps the Interactive Visualization Canvas animating
    for Java student code too.

    ``emit_steps`` controls whether the per-line ``STEP`` records are produced.
    Learning Mode sets it to ``False`` and keeps only the derived graph events.
    """
    recorder = Recorder(initial_data, max_events)

    graph_nodes = initial_data.get("nodes") if isinstance(initial_data, dict) else None
    tracker = JavaGraphStateTracker(graph_nodes) if graph_nodes else None

    record_ptr = 0
    for step in steps:
        while record_ptr < len(records):
            rec = records[record_ptr]
            rec_line = rec.get("line")
            if rec_line is not None and rec_line <= step.get("line", -1):
                _emit_java_record(recorder, rec)
                record_ptr += 1
            else:
                break
        if emit_steps:
            _emit_java_step(recorder, step, target_class)
        if tracker is not None:
            tracker.observe(recorder, step.get("locals") or {}, step.get("line"))

    while record_ptr < len(records):
        _emit_java_record(recorder, records[record_ptr])
        record_ptr += 1

    if tracker is not None:
        tracker.flush(recorder)

    return recorder


def _emit_java_record(recorder: Recorder, record: Dict[str, Any]) -> None:
    event_type = record.get("type", "LOG_MESSAGE")
    if event_type == "SET_VARIABLE":
        data = record.get("data") or {}
        recorder.snapshot["variables"][data.get("name")] = data.get("value")
        return
    recorder.emit(event_type, record.get("description", ""), record.get("data"), record.get("line"))


def _emit_java_step(recorder: Recorder, step: Dict[str, Any], target_class: str) -> None:
    locals_map = step.get("locals") or {}
    call_stack = []
    for frame in (step.get("stack") or []):
        if frame.get("class") == target_class:
            call_stack.append(f"{frame.get('method')} @ {frame.get('line')}")
    recorder.emit("STEP", f"Line {step.get('line')}: {step.get('method')}",
                  {"locals": locals_map, "callStack": call_stack}, step.get("line"))


# ---------------------------------------------------------------------------
# Automatic graph visualisation from Java line-step locals (Trace mode)
# ---------------------------------------------------------------------------
#
# The JDI tracer reports locals as *strings* (e.g. ``"A"``, ``"{A, B}"``,
# ``"[A, B]"``, ``"Map"``). This tracker understands those shapes and reuses
# the same "the node being expanded / the visited set / the current edge / the
# path" heuristic as the Python tracer so Java student code animates the canvas
# without calling the SearchLab API.

# Node-like quoted/unquoted tokens inside a rendered collection.
_JAVA_TOKEN_RE = re.compile(r"[A-Za-z_$][\w$]*|\d+")


class JavaGraphStateTracker:
    """Derive graph highlighting from Java JDI step locals."""

    def __init__(self, graph_nodes: Any):
        self.node_ids: set = set()
        self.label_to_id: Dict[str, str] = {}
        if isinstance(graph_nodes, (list, tuple)):
            for node in graph_nodes:
                if isinstance(node, dict) and node.get("id") is not None:
                    node_id = str(node["id"])
                    self.node_ids.add(node_id)
                    label = node.get("label")
                    if label is not None:
                        self.label_to_id[str(label)] = node_id
                        self.label_to_id.setdefault(str(label).replace(" ", "_"), node_id)
        self.enabled = len(self.node_ids) > 0
        self._last_visited_count = 0
        self._last_active: Optional[str] = None
        self._last_edge: Optional[tuple] = None
        self._last_path: Optional[tuple] = None

    # -- parsing helpers ----------------------------------------------------

    def _as_node(self, text: Any) -> Optional[str]:
        if text is None or isinstance(text, bool):
            return None
        if not isinstance(text, str):
            text = str(text)
        text = text.strip()
        if not text or text in ("null", "None", "Map", "Set", "List"):
            return None
        if text in self.node_ids:
            return text
        return self.label_to_id.get(text)

    def _collection_nodes(self, text: Any) -> Optional[List[str]]:
        """Parse a rendered collection string into a list of graph node ids."""
        if not isinstance(text, str):
            return None
        stripped = text.strip()
        if not stripped or stripped[0] not in "[{":
            return None
        inner = stripped[1:-1] if stripped[-1] in "]}," else stripped[1:]
        result: List[str] = []
        for token in _JAVA_TOKEN_RE.findall(inner):
            node_id = self._as_node(token)
            if node_id is not None:
                result.append(node_id)
        return result or None

    def _as_pair(self, text: Any) -> Optional[tuple]:
        """Parse a rendered ``(u, v)`` / ``u -> v`` / ``[u, v]`` pair."""
        if not isinstance(text, str):
            return None
        tokens = _JAVA_TOKEN_RE.findall(text)
        if len(tokens) == 2:
            a, b = self._as_node(tokens[0]), self._as_node(tokens[1])
            if a is not None and b is not None and a != b:
                return (a, b)
        return None

    # -- derivation ---------------------------------------------------------

    def _derive(self, locals_map: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(locals_map, dict):
            return {}

        result: Dict[str, Any] = {}

        visited: Optional[List[str]] = None
        for name in _VISITED_NAMES:
            if name in locals_map:
                candidate = self._collection_nodes(locals_map[name])
                if candidate is not None:
                    visited = candidate
                    break
        if visited is None:
            for name in _FRONTIER_NAMES:
                if name in locals_map:
                    candidate = self._collection_nodes(locals_map[name])
                    if candidate is not None:
                        visited = candidate
                        break

        active: Optional[str] = None
        for name in _ACTIVE_NODE_NAMES:
            if name in locals_map:
                active = self._as_node(locals_map[name])
                if active is not None:
                    break

        edge: Optional[tuple] = None
        for name in _PARENT_NAMES:
            parent_map = locals_map.get(name)
            if isinstance(parent_map, str) and active is not None:
                parent = self._as_node(parent_map.replace("->", " ").split()[-1])
                if parent is not None and parent != active:
                    edge = (parent, active)
                    break
        if edge is None and active is not None:
            for other in ("v", "neighbor", "neighbour", "next", "nextNode", "to"):
                if other in locals_map:
                    other_id = self._as_node(locals_map[other])
                    if other_id is not None and other_id != active:
                        edge = (active, other_id)
                        break
        if edge is None:
            for name in ("edge", "e", "pair"):
                if name in locals_map:
                    pair = self._as_pair(locals_map[name])
                    if pair is not None:
                        edge = pair
                        break

        path: Optional[List[str]] = None
        for name in _PATH_NAMES:
            if name in locals_map:
                candidate = self._collection_nodes(locals_map[name])
                if candidate is not None and len(candidate) >= 2:
                    path = candidate
                    break

        if visited is not None:
            result["visited"] = visited
        if active is not None:
            result["active"] = active
        if edge is not None:
            result["edge"] = edge
        if path is not None:
            result["path"] = path
        return result

    # -- public -------------------------------------------------------------

    def observe(self, recorder: Recorder, locals_map: Dict[str, Any],
                line: Optional[int]) -> None:
        if not self.enabled:
            return
        derived = self._derive(locals_map)
        if not derived:
            return

        path = derived.get("path")
        if path:
            key = tuple(path)
            if key != self._last_path:
                self._last_path = key
                recorder.emit("GOAL_FOUND", f"Found path: {' -> '.join(path)}",
                              {"path": path}, line)
                return

        edge = derived.get("edge")
        if edge:
            if edge != self._last_edge:
                self._last_edge = edge
                recorder.emit("EDGE_RELAXED",
                              f"Traversed edge ({edge[0]} -> {edge[1]})",
                              {"from": edge[0], "to": edge[1]}, line)

        active = derived.get("active")
        if active is not None and active != self._last_active:
            self._last_active = active
            recorder.emit("NODE_EXPANDED", f'Visited/Expanded node "{active}"',
                          {"nodeId": active}, line)

        visited = derived.get("visited") or []
        if len(visited) > self._last_visited_count:
            for node_id in visited[self._last_visited_count:]:
                if node_id != self._last_active:
                    recorder.emit("NODE_EXPANDED", f'Visited node "{node_id}"',
                                  {"nodeId": node_id}, line)
            self._last_visited_count = len(visited)

    def flush(self, recorder: Recorder) -> None:
        """No-op hook kept for symmetry with the Python tracer's final pass."""
        return


def _read_jsonl(path: str) -> List[Dict[str, Any]]:
    records: List[Dict[str, Any]] = []
    if not os.path.isfile(path):
        return records
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return records


def _kill_process_tree(pid: int) -> None:
    """Terminate a process and all of its children.

    On Windows, killing a ``java`` launcher does not stop the real JVM child,
    which keeps the captured output pipes open and would otherwise make
    ``communicate()`` block forever.
    """
    if os.name == "nt":
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)],
                       capture_output=True, timeout=10)
        return
    try:
        os.killpg(os.getpgid(pid), signal.SIGKILL)
    except (OSError, AttributeError):
        try:
            os.kill(pid, signal.SIGKILL)
        except OSError:
            pass


def _run_bounded(cmd, timeout: float, env: Optional[Dict[str, str]] = None):
    """Run a subprocess with a hard wall-clock timeout.

    Raises :class:`subprocess.TimeoutExpired` on timeout, after ensuring the
    whole process tree has been terminated.
    """
    popen_kwargs: Dict[str, Any] = dict(
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        stdin=subprocess.DEVNULL, text=True, env=env)
    if os.name != "nt":
        popen_kwargs["start_new_session"] = True

    proc = subprocess.Popen(cmd, **popen_kwargs)
    try:
        out, err = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        _kill_process_tree(proc.pid)
        try:
            out, err = proc.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            out, err = "", ""
        raise subprocess.TimeoutExpired(cmd, timeout, output=out, stderr=err)
    return subprocess.CompletedProcess(cmd, proc.returncode, out, err)


def execute_java(code: str, input_data: Any, mode: str, max_events: int,
                 time_limit_ms: Optional[int] = None) -> Dict[str, Any]:
    start_time = time.perf_counter()
    logs: List[str] = []
    java_timeout = (time_limit_ms / 1000.0) if time_limit_ms else 30.0
    try:
        ensure_java_compiled()
    except Exception as exc:  # noqa: BLE001
        return _error_result(str(exc), None, None, start_time, logs)

    class_name = _java_class_name(code)
    if not class_name:
        return _error_result("No Java class declaration found in the source.",
                             None, None, start_time, logs)

    # Force the default package so the bundled SearchLab runtime is visible.
    source = _JAVA_PACKAGE_RE.sub("", code)

    workdir = tempfile.mkdtemp(prefix="searchlab_java_")
    classes_dir = os.path.join(workdir, "classes")
    os.makedirs(classes_dir, exist_ok=True)
    source_path = os.path.join(workdir, class_name + ".java")
    input_path = os.path.join(workdir, "input.json")
    events_path = os.path.join(workdir, "events.jsonl")
    steps_path = os.path.join(workdir, "steps.json")

    with open(source_path, "w", encoding="utf-8") as handle:
        handle.write(source)
    with open(input_path, "w", encoding="utf-8") as handle:
        json.dump(input_data, handle)

    # 1. Compile the user's program with debug info (needed for locals).
    compile_result = subprocess.run(
        [JAVAC, "-g", "-cp", JAVA_CLASSES, "-d", classes_dir, source_path],
        capture_output=True, text=True, timeout=120)
    if compile_result.returncode != 0:
        message = (compile_result.stderr or compile_result.stdout or "Java compilation failed").strip()
        return _error_result(message, _java_error_line(compile_result.stderr), None,
                             start_time, logs)

    target_cp = classes_dir + os.pathsep + JAVA_CLASSES

    # In Learning (instrumented) mode the JDI tracer is only run when the code
    # never touches the SearchLab API: the traced locals are then used to derive
    # graph highlighting so pasted student code still animates the canvas.
    trace_under_jdi = (mode == "trace") or not _java_uses_visualizer_api(code)

    # 2. Execute (bounded so an infinite loop cannot hang the worker forever).
    try:
        if trace_under_jdi:
            env = dict(os.environ)
            env["SEARCHLAB_VM_OPTS"] = f"-Dsearchlab.events={events_path}"
            run_result = _run_bounded(
                [JAVA, "-cp", JAVA_CLASSES, "JavaTracer", class_name, target_cp,
                 steps_path, input_path],
                java_timeout, env=env)
        else:
            run_result = _run_bounded(
                [JAVA, f"-Dsearchlab.events={events_path}", "-cp", target_cp,
                 class_name, input_path],
                java_timeout)
    except subprocess.TimeoutExpired:
        return _error_result(
            f"Java execution exceeded the {java_timeout:.0f}s time limit "
            "(possible infinite loop).",
            None, None, start_time, logs)

    stdout = (run_result.stdout or "").strip()
    if stdout:
        logs.extend(line for line in stdout.splitlines() if line)

    records = _read_jsonl(events_path)
    duration_ms = int((time.perf_counter() - start_time) * 1000)

    if trace_under_jdi:
        steps: List[Dict[str, Any]] = []
        if os.path.isfile(steps_path):
            with open(steps_path, "r", encoding="utf-8") as handle:
                content = handle.read().strip()
            if content:
                try:
                    steps = json.loads(content)
                except json.JSONDecodeError:
                    steps = []
        recorder = _build_from_java_steps(steps, records, class_name, input_data,
                                          max_events, emit_steps=(mode == "trace"))
    else:
        recorder = _build_from_java_records(records, input_data, max_events)

    if not recorder.events or recorder.events[-1]["type"] != "ALGORITHM_COMPLETED":
        recorder.complete()

    if run_result.returncode != 0 and not logs and run_result.stderr:
        logs.extend(line for line in run_result.stderr.strip().splitlines() if line)
        return {
            "success": False,
            "events": recorder.events,
            "error": {
                "message": run_result.stderr.strip() or "Java program exited with an error.",
                "line": _java_error_line(run_result.stderr),
                "stack": run_result.stderr,
            },
            "totalSteps": len(recorder.events),
            "durationMs": duration_ms,
            "logs": recorder.logs,
        }

    return {
        "success": True,
        "events": recorder.events,
        "totalSteps": len(recorder.events),
        "durationMs": duration_ms,
        "logs": recorder.logs,
    }


def _error_result(message: str, line: Optional[int], stack: Optional[str],
                  start_time: float, logs: List[str]) -> Dict[str, Any]:
    return {
        "success": False,
        "events": [],
        "error": {"message": message, "line": line, "stack": stack},
        "totalSteps": 0,
        "durationMs": int((time.perf_counter() - start_time) * 1000),
        "logs": logs,
    }


# ---------------------------------------------------------------------------
# Request models & routes
# ---------------------------------------------------------------------------

class ExecuteRequest(BaseModel):
    code: str
    input: Any = None
    mode: Optional[str] = "instrumented"
    max_events: Optional[int] = 20000
    time_limit_ms: Optional[int] = None


def execute_python(code: str, input_data: Any, mode: str, max_events: int,
                   time_limit_ms: Optional[int] = None) -> Dict[str, Any]:
    recorder = Recorder(input_data, max_events)
    start_time = time.perf_counter()

    old_stdout = sys.stdout
    redirected_output = StringIO()
    sys.stdout = redirected_output

    scope = {
        # Run the program as if it were the main script, so the common
        # ``if __name__ == "__main__":`` entry-point block actually executes.
        # Without this, exec() resolves __name__ to "builtins" and the whole
        # block is silently skipped.
        "__name__": "__main__",
        "visualizer": recorder,
        "v": recorder,
        "input": copy.deepcopy(input_data),
        "data": copy.deepcopy(input_data),
        "print": lambda *args: recorder.log(" ".join(str(a) for a in args)),
    }

    tracer_installed = False
    try:
        compiled = compile(code, USER_FILENAME, "exec")

        # Always trace so that even a loop which never touches the visualizer
        # API is bounded by the deadline. Only Mode B emits STEP records.
        wall_limit = (time_limit_ms / 1000.0) if time_limit_ms else PYTHON_WALL_LIMIT_SECONDS
        deadline = time.perf_counter() + wall_limit

        # Derive graph highlighting from the student's locals so their own
        # search code animates the canvas. This is always on in Trace mode; in
        # Learning (instrumented) mode it is enabled only when the code makes
        # no ``visualizer.*`` calls at all - if the code drives the API itself,
        # that explicit narration is respected instead.
        graph_nodes = None
        if isinstance(input_data, dict):
            graph_nodes = input_data.get("nodes")
        derive_graph_state = (mode == "trace") or not _uses_visualizer_api(code)
        graph_tracker = (
            GraphStateTracker(graph_nodes)
            if graph_nodes and derive_graph_state else None
        )

        sys.settrace(_make_tracer(recorder, emit_steps=(mode == "trace"),
                                  deadline=deadline,
                                  graph_tracker=graph_tracker,
                                  emit_graph_state=derive_graph_state))
        tracer_installed = True

        exec(compiled, scope)

        if tracer_installed:
            sys.settrace(None)
            tracer_installed = False

        captured = redirected_output.getvalue().strip()
        if captured:
            for line in captured.splitlines():
                if line and line not in recorder.logs:
                    recorder.logs.append(line)

        if not recorder.events or recorder.events[-1]["type"] != "ALGORITHM_COMPLETED":
            recorder.complete()

        return {
            "success": True,
            "events": recorder.events,
            "totalSteps": len(recorder.events),
            "durationMs": int((time.perf_counter() - start_time) * 1000),
            "logs": recorder.logs,
        }

    except Exception as exc:  # noqa: BLE001
        tb_lines = traceback.format_exc().splitlines()
        err_line = None
        for line in tb_lines:
            if f'{USER_FILENAME}", line' in line:
                try:
                    err_line = int(line.split("line ")[1].split(",")[0])
                except (IndexError, ValueError):
                    pass

        try:
            recorder.emit("EXECUTION_ERROR", str(exc), {"error": str(exc)}, err_line)
        except RuntimeError:
            pass

        return {
            "success": False,
            "events": recorder.events,
            "error": {
                "message": str(exc),
                "line": err_line,
                "stack": traceback.format_exc(),
            },
            "totalSteps": len(recorder.events),
            "durationMs": int((time.perf_counter() - start_time) * 1000),
            "logs": recorder.logs,
        }

    finally:
        if tracer_installed:
            sys.settrace(None)
        sys.stdout = old_stdout


@app.post("/execute")
def execute_python_code(req: ExecuteRequest):
    return execute_python(req.code, req.input, req.mode or "instrumented",
                          req.max_events or 20000, req.time_limit_ms)


@app.post("/execute-java")
def execute_java_code(req: ExecuteRequest):
    return execute_java(req.code, req.input, req.mode or "instrumented",
                        req.max_events or 20000, req.time_limit_ms)


class ExtractGraphRequest(BaseModel):
    code: str = ""


@app.post("/extract-graph")
def extract_graph_code(req: ExtractGraphRequest):
    """Extract a graph defined inside code so the canvas can be redesigned."""
    return extract_graph(req.code)


@app.get("/")
def root():
    java_ok = bool(JAVA and JAVAC)
    return {
        "service": "SearchLab Execution Engine",
        "status": "ok",
        "languages": ["python", "java"] if java_ok else ["python"],
        "endpoints": {
            "health": "GET /health",
            "execute_python": "POST /execute",
            "execute_java": "POST /execute-java",
            "extract_graph": "POST /extract-graph",
            "docs": "GET /docs",
        },
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "SearchLab Execution Engine",
        "python": sys.version.split()[0],
        "java": "available" if (JAVA and JAVAC) else "unavailable",
        # The frontend uses this to hide the Java language option when the
        # engine is hosted somewhere without a JDK (e.g. Vercel).
        "languages": (["python", "java"] if (JAVA and JAVAC) else ["python"]),
    }


# ---------------------------------------------------------------------------
# Windows event-loop selection
# ---------------------------------------------------------------------------
# uvicorn defaults to asyncio's ProactorEventLoop on Windows. Its IOCP-based
# accept() raises ``OSError [WinError 64] The specified network name is no
# longer available`` when a client closes a connection abruptly, and that
# exception kills the whole event loop - which is why the engine appeared to
# "randomly die" whenever a browser tab or the test runner disconnected.
# The selector-based loop does not use IOCP and is immune to this.
#
# Setting the policy alone is NOT enough: ``uvicorn.run(loop="asyncio")`` sets
# up its own loop, and on some uvicorn builds that reinstates the Proactor
# loop. So we also build the selector loop explicitly and pass it to
# ``uvicorn.Server.run`` via ``asyncio.run`` with an explicit loop factory.
if sys.platform == "win32":
    import asyncio

    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


def _make_selector_loop() -> "asyncio.AbstractEventLoop":
    """Create a fresh selector-based event loop (Windows-safe accept())."""
    import asyncio

    if sys.platform == "win32":
        return asyncio.SelectorEventLoop()
    return asyncio.new_event_loop()


if __name__ == "__main__":
    import asyncio
    import uvicorn

    # Bind to all interfaces when hosted in a container (default), so the
    # platform's proxy can reach the service. Override with SEARCHLAB_HOST.
    host = os.environ.get("SEARCHLAB_HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", os.environ.get("SEARCHLAB_PORT", "8000")))

    config = uvicorn.Config(app, host=host, port=port, log_level="info")
    server = uvicorn.Server(config)

    # Run uvicorn on the selector loop we create ourselves, so the Proactor
    # loop can never reappear regardless of uvicorn's internal defaults.
    loop = _make_selector_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(server.serve())
    except KeyboardInterrupt:
        pass
    finally:
        try:
            loop.run_until_complete(loop.shutdown_asyncgens())
        finally:
            loop.close()
