"""
Vercel entrypoint for the SearchLab execution engine.

Vercel looks for a FastAPI instance named ``app`` at supported entrypoints,
including ``app/main.py`` (``api/index.py`` is not one of them). The full engine
lives in ``python_engine.py`` at the repository root; this module re-exports it
so Vercel can load it without duplicating any logic.

What runs here
--------------
* ``POST /extract-graph``  - pure ``ast`` parsing, no execution. Always works.
* ``POST /execute``        - Python execution (Learning and Trace modes).

What does NOT run here
----------------------
* ``POST /execute-java``   - Vercel ships no JDK and forbids the subprocess work
  the Java path needs. ``GET /health`` reports ``java: "unavailable"`` so the
  frontend hides the Java option when hosted.

Locally nothing changes: run ``python python_engine.py`` and both languages work.
"""

import os
import sys

# Make the repository root importable when Vercel loads this file from app/.
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from python_engine import app  # noqa: E402  (import must follow sys.path setup)

__all__ = ["app"]
